using System.Diagnostics;
using System.Formats.Tar;
using System.Globalization;
using System.Net;
using Azure.Storage.Blobs;
using ICSharpCode.SharpZipLib.BZip2;
using NodaTime;
using NodaTime.Text;

namespace DwdCli;

internal class DwdRemapProcessor(
    string cdoPath,
    BlobContainerClient blobContainerClient,
    HttpClient httpClient)
{
    private readonly LocalDatePattern _localDatePattern =
        LocalDatePattern.Create("yyyyMMdd", CultureInfo.InvariantCulture);

    public async Task Run()
    {
        var gridWeight0125 = await DownloadGridWeightFiles(GridResolution._0125);
        var gridWeight025 = await DownloadGridWeightFiles(GridResolution._025);

        var now = SystemClock.Instance.GetCurrentInstant();
        var today = now.InUtc().Date;

        foreach (var forecastType in Enum.GetValues<ForecastType>())
        {
            foreach (var forecastTime in Enum.GetValues<ForecastTime>())
            {
                foreach (var hourOffset in HourOffsets())
                {
                    var date = _localDatePattern.Format(today);
                    var time = forecastTime.StringFormat();
                    var type = forecastType.StringFormat();
                    var typeLower = type.ToLowerInvariant();
                    var suffix = $"{date}{time}_{hourOffset:000}_{type}.grib2";
                    var icosahedralGribFile = $"icon_global_icosahedral_single-level_{suffix}";

                    var blobClient = blobContainerClient.GetBlobClient($"weather/nwp/icon/grib/{date}/{time}/icosahedral/{typeLower}/{icosahedralGribFile}.bz2");

                    if (await blobClient.ExistsAsync())
                    {
                        Console.WriteLine($"Skipping file {icosahedralGribFile}, already exists.");
                        continue;
                    }

                    using var httpResponseMessage = await httpClient.GetAsync(new Uri($"weather/nwp/icon/grib/{time}/{typeLower}/{icosahedralGribFile}.bz2", UriKind.Relative));
                    if (httpResponseMessage.StatusCode == HttpStatusCode.NotFound)
                    {
                        continue;
                    }

                    httpResponseMessage.EnsureSuccessStatusCode();

                    await using var stream = await httpResponseMessage.Content.ReadAsStreamAsync();
                    await using var zipUncompressed = new BZip2InputStream(stream);

                    var icosahedralGribFilePath = Path.GetTempFileName();
                    await using var file = File.OpenWrite(icosahedralGribFilePath);
                    await zipUncompressed.CopyToAsync(file);
                    await file.FlushAsync();
                    file.Close();

                    await RemapAndUpload(
                        gridWeight0125,
                        icosahedralGribFilePath,
                        $"weather/nwp/icon/grib/{date}/{time}/WGS84_{GridResolution._0125.StringFormat()}/{typeLower}/icon_global_WGS84_{GridResolution._0125.StringFormat()}_single-level_{suffix}.bz2");

                    await RemapAndUpload(
                        gridWeight025,
                        icosahedralGribFilePath,
                        $"weather/nwp/icon/grib/{date}/{time}/WGS84_{GridResolution._025.StringFormat()}/{typeLower}/icon_global_WGS84_{GridResolution._025.StringFormat()}_single-level_{suffix}.bz2");

                    stream.Position = 0;
                    await blobClient.UploadAsync(stream);
                }
            }
        }
    }

    private async Task RemapAndUpload(
        GridWeightFiles gridWeightFiles,
        string icosahedralGribFile,
        string blobName)
    {
        var tempFile = Path.GetTempFileName();

        var processStartInfo = new ProcessStartInfo(
            cdoPath,
            [
                "-f",
                "grb2",
                $"remap,{gridWeightFiles.GridFile},{gridWeightFiles.WeightFile}",
                icosahedralGribFile,
                tempFile,
            ])
        {
            CreateNoWindow = false,
            UseShellExecute = true
        };

        var process = Process.Start(processStartInfo);
        if (process is null)
        {
            throw new Exception("Should never get here");
        }

        await process.WaitForExitAsync();

        await using var memoryStream = new MemoryStream();
        await using var stream = new BZip2OutputStream(memoryStream);

        await using var fileStream = File.OpenRead(tempFile);
        await fileStream.CopyToAsync(stream);

        memoryStream.Position = 0;
        await blobContainerClient.UploadBlobAsync(blobName, memoryStream);

        File.Delete(tempFile);
    }

    private async Task<GridWeightFiles> DownloadGridWeightFiles(GridResolution resolution)
    {
        var output = Directory.CreateTempSubdirectory();
        var weightName = $"ICON_GLOBAL2WORLD_{resolution.StringFormat()}_EASY";
        var weightUrl = new Uri($"weather/lib/cdo/{weightName}.tar.bz2", UriKind.Relative);

        await using var stream = await httpClient.GetStreamAsync(weightUrl);
        await using var zipUncompressed = new BZip2InputStream(stream);

        await TarFile.ExtractToDirectoryAsync(zipUncompressed, output.FullName, overwriteFiles: false);

        var gridFile = Path.Combine(output.FullName, weightName, $"target_grid_world_{resolution.StringFormat()}.txt");
        var weightFile = Path.Combine(output.FullName, weightName, $"weights_icogl2world_{resolution.StringFormat()}.nc");

        return new GridWeightFiles
        {
            GridFile = gridFile,
            WeightFile = weightFile,
        };
    }

    private IEnumerable<int> HourOffsets()
    {
        for (var i = 0; i <= 78; i++)
        {
            yield return i;
        }

        for (var i = 81; i <= 180; i += 3)
        {
            yield return i;
        }
    }

}