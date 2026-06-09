idf_component_register(
        SRCS main.cc ../../_components/dht_component.c ../../_components/mqtt_component.c
        INCLUDE_DIRS "" "../../_components"
        REQUIRES driver esp_wifi esp_netif nvs_flash esp_http_client esp_http_server lwip mqtt)

# Force-enable CSI (overrides sdkconfig if needed)
target_compile_definitions(${COMPONENT_LIB} PRIVATE
    CONFIG_SHOULD_COLLECT_CSI=1
    CONFIG_SHOULD_COLLECT_ONLY_LLTF=1
    CONFIG_SEND_CSI_TO_SERIAL=1
)
