#!/bin/bash

download_grid_weight() {
    local resolution=$1
    local weight_name="ICON_GLOBAL2WORLD_${resolution}_EASY"
    local weight_url="https://opendata.dwd.de/weather/lib/cdo/${weight_name}.tar.bz2"
    curl -O $weight_url
    tar -xvjf "$weight_name.tar.bz2"
}

# download "00" "v_10m" 0 "20240413" "025"
download() {
    local forecast=$1

    local type=$2
    local type_upper=$(echo "$2" | awk '{ print toupper($0) }')

    local offset=$(printf "%03d" $3)

    local dt="$4$forecast"

    local resolution=$5

    local weight_file="ICON_GLOBAL2WORLD_${resolution}_EASY/target_grid_world_${resolution}.txt"
    local grid_file="ICON_GLOBAL2WORLD_${resolution}_EASY/weights_icogl2world_${resolution}.nc"

    local base_name="icon_global_icosahedral_single-level_${dt}_${offset}_$type_upper.grib2"
    local name="$base_name.bz2"
    local url="https://opendata.dwd.de/weather/nwp/icon/grib/$forecast/$type/$name"
    local blob_name="weather/nwp/icon/icosahedral/$type/$dt/$name"
    local mapped_base_name="icon_global_WGS84_${resolution}_single-level_${dt}_${offset}_$type_upper.grib2"
    local mapped_blob_name="weather/nwp/icon/WGS84_${resolution}/$type/$dt/${mapped_base_name}.bz2"

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

        bunzip2 $name

        ./cdo -f grb2 remap,$grid_file,$weight_file $base_name $mapped_base_name

        bzip2 $mapped_base_name

        az storage blob upload \
            --auth-mode login \
            --account-name dwdremap \
            --container-name dwd \
            --file "$mapped_base_name.bz2" \
            --name "$mapped_blobl_name"

        az storage blob upload \
            --auth-mode login \
            --account-name dwdremap \
            --container-name dwd \
            --file $name \
            --name $blob_name

        rm $base_name
        rm "$mapped_base_name.bz2"
    fi
}

current_date=$(date -u +%Y%m%d)
mkdir -p $current_date
cd $current_date

download_grid_weight "025"
download_grid_weight "0125"

for f in "00" "06" "12" "18";
do
    for i in $(seq 0 1 78);
    do
        download $f "v_10m" $i $current_date "025"
    done

    for i in $(seq 81 3 180);
    do
        download $f "v_10m" $i $current_date "025"
    done
done

cd ..
