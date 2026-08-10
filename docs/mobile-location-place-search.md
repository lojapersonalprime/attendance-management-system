# Pesquisa de locais autorizados

## Auditoria do erro anterior

Ao criar um local, o formulário sempre enviava o campo oculto `id` com valor vazio (`""`). O schema `authorizedLocationSchema` aceitava `id` ausente, mas rejeitava uma string vazia por exigir ao menos um caractere. O Zod então emitia o código geral `validacao`, apresentado como “Revise os campos informados antes de continuar.”

O problema não estava em `unitId`, `name`, `latitude`, `longitude`, `radiusMeters`, `maxAccuracyMeters`, `exceptionPolicy` nem em `active`: todos chegavam à Server Action e eram compatíveis com Prisma quando preenchidos. O schema agora normaliza `id=""` e `placeProvider=""` para ausência, preservando a validação dos demais campos e mensagens específicas por campo.

## Arquitetura

`PlaceSearchProvider` isola a pesquisa de locais. `PLACE_SEARCH_PROVIDER=photon` é o padrão do piloto e usa Photon/OpenStreetMap; `PLACE_SEARCH_PROVIDER=google` mantém a implementação opcional de Places API (New). As chamadas passam somente por APIs internas que exigem `RH_ADMIN`.

Photon retorna GeoJSON. A aplicação normaliza o `osm_type` + `osm_id` como `providerPlaceId`, nome, endereço humano, latitude e longitude, sem persistir a resposta bruta. Ao salvar, o servidor confirma novamente o local do provider e substitui latitude, longitude e endereço enviados pelo formulário pela resposta normalizada. Para os fallbacks de localização atual e coordenadas manuais, o servidor valida os limites de latitude/longitude, raio, precisão e unidade.

`AuthorizedLocation` persiste `placeProvider`, `providerPlaceId` e `formattedAddress`, além das coordenadas já existentes. A batida mobile consulta apenas a localização persistida e usa Haversine; não chama Photon nem Google. A tela mantém os fallbacks de localização atual e coordenadas manuais e exibe a atribuição discreta a OpenStreetMap contributors.

## Preview Vercel

Em Preview, configure `PLACE_SEARCH_PROVIDER=photon` e `MOBILE_PUNCH_ENABLED=true`; não é necessário cadastrar `GOOGLE_MAPS_API_KEY`. `PHOTON_BASE_URL` pode ser omitida para usar `https://photon.komoot.io`. O endpoint público é apropriado somente para piloto/baixo volume; para produção de maior volume, prefira instância própria ou provider comercial. Se Google for selecionado sem a chave, a interface mostra erro de configuração claro e mantém os fallbacks.
