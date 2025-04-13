#!/bin/sh

# download "00" "v_10m" 0 "20240413"
download() {
    local forecast=$1

    local type=$2
    local type_upper=$(echo "$2" | awk '{ print toupper($0) }')

    local offset=$(printf "%03d" $3)

    local dt="$4$forecast"

    local name="icon_global_icosahedral_single-level_${dt}_${offset}_$type_upper.grib2.bz2"
    local url="https://opendata.dwd.de/weather/nwp/icon/grib/$forecast/$type/$name"
    local blob_name="weather/nwp/icon/$type/$dt/$name"

    result=$(az storage blob exists \
        --auth-mode login \
        --account-name dwdremap \
        --container-name dwd \
        --name $blob_name)

    if jq -e '.exists' <<< "$result" > /dev/null;
    then
        echo "Skipping $name as it already exists."
    else
        curl -O $url
        az storage blob upload \
            --auth-mode login \
            --account-name dwdremap \
            --container-name dwd \
            --file $name \
            --name $blob_name
        rm $name
    fi
}

current_date=$(date -u +%Y%m%d)
mkdir -p $current_date
cd $current_date

for f in "00" "06" "12" "18";
do
    for i in $(seq 0 1 78);
    do
        download $f "v_10m" $i $current_date
    done

    for i in $(seq 81 3 180);
    do
        download $f "v_10m" $i $current_date
    done
done

cd ..
