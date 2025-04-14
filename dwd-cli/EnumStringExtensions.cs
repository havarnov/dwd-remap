internal static class EnumStringExtensions
{
    public static string StringFormat(this GridResolution resolution)
    {
        return resolution switch {
            GridResolution._0125 => "0125",
            GridResolution._025 => "025",
            _ => throw new ArgumentOutOfRangeException(nameof(resolution), resolution, null)
        };
    }

    public static string StringFormat(this ForecastTime forecastTime)
    {
        return forecastTime switch
        {
            ForecastTime._00 => "00",
            ForecastTime._06 => "06",
            ForecastTime._12 => "12",
            ForecastTime._18 => "18",
            _ => throw new ArgumentOutOfRangeException(nameof(forecastTime), forecastTime, null)
        };
    }

    public static string StringFormat(this ForecastType forecastType)
    {
        return forecastType switch {
            ForecastType.U10M => "U_10M",
            ForecastType.V10M => "V_10M",
            _ => throw new ArgumentOutOfRangeException(nameof(forecastType), forecastType, null)
        };
    }
}