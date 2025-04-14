using Azure.Identity;
using Azure.Storage.Blobs;
using CommandLine;
using DwdCli;

return await Parser.Default.ParseArguments<object, DownloadRemapUpload>(args)
    .MapResult(
        (DownloadRemapUpload opt) => HandleDownloadRemapUpload(opt),
        _ => Task.FromResult(1));

async Task<int> HandleDownloadRemapUpload(DownloadRemapUpload options)
{
    var httpClient = new HttpClient()
    {
        BaseAddress = new Uri("https://opendata.dwd.de/"),
    };

    var remapProcessor = new DwdRemapProcessor(
        options.CdoPath,
        new BlobContainerClient(new Uri("https://dwdremap.blob.core.windows.net/dwd"), new DefaultAzureCredential()),
        httpClient);

    await remapProcessor.Run();

    return 0;
}

[Verb("download-remap-upload", HelpText = "Download, remap and upload grib2 files.")]
internal class DownloadRemapUpload
{
    [Option("cdo-path", HelpText = "The path to cdo.", Required = true)]
    public required string CdoPath { get; init; }
}
