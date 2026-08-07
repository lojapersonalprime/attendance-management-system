# Pesquisa de locais autorizados

## Auditoria do erro anterior

Ao criar um local, o formulário sempre enviava o campo oculto `id` com valor vazio (`""`). O schema `authorizedLocationSchema` aceitava `id` ausente, mas rejeitava uma string vazia por exigir ao menos um caractere. O Zod então emitia o código geral `validacao`, apresentado como “Revise os campos informados antes de continuar.”

O problema não estava em `unitId`, `name`, `latitude`, `longitude`, `radiusMeters`, `maxAccuracyMeters`, `exceptionPolicy` nem em `active`: todos chegavam à Server Action e eram compatíveis com Prisma quando preenchidos. O schema agora normaliza `id=""` e `placeProvider=""` para ausência, preservando a validação dos demais campos e mensagens específicas por campo.

## Arquitetura

`PlaceSearchProvider` isola a Places API (New). A implementação Google usa Autocomplete (New) para sugestões e Place Details (New) para nome, endereço e coordenadas. A chave é usada somente no servidor por APIs internas que exigem `RH_ADMIN`.

Depois da seleção, o browser recebe o local para exibição. Ao salvar, o servidor consulta o provider novamente pelo `providerPlaceId` e substitui latitude, longitude e endereço enviados pelo formulário pela resposta do provider. Para os fallbacks de localização atual e coordenadas manuais, o servidor valida os limites de latitude/longitude, raio, precisão e unidade.

`AuthorizedLocation` persiste `placeProvider`, `providerPlaceId` e `formattedAddress`, além das coordenadas já existentes. A batida mobile consulta apenas a localização persistida e usa Haversine; não chama Google.

## Preview Vercel

Cadastre `GOOGLE_MAPS_API_KEY` como variável server-side nos ambientes Preview e Production. O repositório não contém configuração ou credencial da Vercel, portanto a busca real no Preview depende dessa variável ser cadastrada no projeto. Sem ela, a interface mantém os fallbacks e mostra uma mensagem humana de serviço não configurado.
