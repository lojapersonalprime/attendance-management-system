"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, LocateFixed, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { ErrorState, InlineSpinner, LoadingButton, RetryButton } from "@/components/ui/async-feedback";
import { PLACE_SEARCH_DEBOUNCE_MS, shouldSearchPlaces, type PlaceDetails, type PlaceProviderName, type PlaceSuggestion } from "@/modules/places/domain/place-search";

type ServerAction = (formData: FormData) => void | Promise<void>;
type UnitOption = { id: string; name: string };
type LocationDraft = {
  id?: string;
  unitId: string;
  name: string;
  placeProvider?: string | null;
  providerPlaceId?: string | null;
  formattedAddress?: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
  exceptionPolicy: "ALLOW_AND_REVIEW" | "BLOCK";
  active: boolean;
};

type LocationMethod = "PLACE" | "CURRENT_LOCATION" | "MANUAL";
type Selection = {
  method: LocationMethod;
  latitude: string;
  longitude: string;
  formattedAddress: string;
  placeProvider?: PlaceProviderName;
  providerPlaceId?: string;
  providerSearchQuery?: string;
};

function newSessionToken() {
  return crypto.randomUUID();
}

function mapUrl(selection: Selection) {
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(selection.latitude)}&mlon=${encodeURIComponent(selection.longitude)}#map=18/${encodeURIComponent(selection.latitude)}/${encodeURIComponent(selection.longitude)}`;
}

function isPlaceProvider(value: string | null | undefined): value is PlaceProviderName {
  return value === "GOOGLE_PLACES" || value === "OPENSTREETMAP_PHOTON";
}

function isCoordinateSelection(selection: Selection | undefined) {
  if (!selection) return false;
  const latitude = Number(selection.latitude);
  const longitude = Number(selection.longitude);
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export function AuthorizedLocationForm({ action, units, location }: { action: ServerAction; units: UnitOption[]; location?: LocationDraft }) {
  const initialSelection: Selection | undefined = location ? {
    method: isPlaceProvider(location.placeProvider) && location.providerPlaceId ? "PLACE" : "MANUAL",
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    formattedAddress: location.formattedAddress ?? "",
    placeProvider: isPlaceProvider(location.placeProvider) ? location.placeProvider : undefined,
    providerPlaceId: location.providerPlaceId ?? undefined,
    providerSearchQuery: location.providerPlaceId ? `${location.name} ${location.formattedAddress ?? ""}`.trim() : undefined,
  } : undefined;
  const [name, setName] = useState(location?.name ?? "");
  const [selection, setSelection] = useState<Selection | undefined>(initialSelection);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [currentLocationLoading, setCurrentLocationLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(initialSelection?.method === "MANUAL");
  const [error, setError] = useState<string>();
  const [searchAttempt, setSearchAttempt] = useState(0);
  const sessionToken = useRef<string | undefined>(undefined);

  function startSession() {
    sessionToken.current = newSessionToken();
    return sessionToken.current;
  }

  function clearProviderSelection() {
    if (selection?.method === "PLACE") setSelection(undefined);
  }

  useEffect(() => {
    const normalized = query.trim();
    if (!shouldSearchPlaces(normalized)) {
      return;
    }
    const token = sessionToken.current ?? startSession();
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/place-search?${new URLSearchParams({ query: normalized, sessionToken: token })}`, { signal: controller.signal });
        const body = await response.json() as { places?: PlaceSuggestion[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Não foi possível acessar o serviço de locais.");
        setSuggestions(body.places ?? []);
        setError(undefined);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setError(reason instanceof Error ? reason.message : "Não foi possível acessar o serviço de locais.");
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, PLACE_SEARCH_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, searchAttempt]);

  async function chooseSuggestion(suggestion: PlaceSuggestion) {
    setResolving(true);
    setError(undefined);
    try {
      const token = sessionToken.current ?? startSession();
      const searchParams = new URLSearchParams({ sessionToken: token });
      if (suggestion.detailsQuery) searchParams.set("query", suggestion.detailsQuery);
      const response = await fetch(`/api/place-search/${encodeURIComponent(suggestion.providerPlaceId)}?${searchParams}`);
      const body = await response.json() as { place?: PlaceDetails; error?: string };
      if (!response.ok || !body.place) throw new Error(body.error || "Não conseguimos obter os detalhes deste endereço.");
      const place = body.place;
      setSelection({ method: "PLACE", placeProvider: place.provider, providerPlaceId: place.providerPlaceId, providerSearchQuery: suggestion.detailsQuery, formattedAddress: place.formattedAddress, latitude: String(place.latitude), longitude: String(place.longitude) });
      setName(place.displayName);
      setQuery("");
      setSuggestions([]);
      sessionToken.current = undefined;
      setManualOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não conseguimos obter os detalhes deste endereço.");
    } finally {
      setResolving(false);
    }
  }

  function useCurrentLocation() {
    setError(undefined);
    if (!navigator.geolocation) {
      setError("Não foi possível obter sua localização neste navegador.");
      return;
    }
    setCurrentLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelection({ method: "CURRENT_LOCATION", latitude: String(position.coords.latitude), longitude: String(position.coords.longitude), formattedAddress: "Coordenadas obtidas pela localização atual do navegador." });
        setName((value) => value || "Local de registro");
        setManualOpen(false);
        setCurrentLocationLoading(false);
      },
      () => {
        setError("Permita o acesso à localização para usar sua posição atual.");
        setCurrentLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  function openManualCoordinates() {
    setError(undefined);
    setManualOpen(true);
    setSelection((current) => current?.method === "MANUAL" ? current : { method: "MANUAL", latitude: "", longitude: "", formattedAddress: "Coordenadas informadas manualmente pelo RH." });
  }

  function updateManualCoordinate(field: "latitude" | "longitude", value: string) {
    setSelection((current) => ({ method: "MANUAL", latitude: field === "latitude" ? value : current?.latitude ?? "", longitude: field === "longitude" ? value : current?.longitude ?? "", formattedAddress: "Coordenadas informadas manualmente pelo RH." }));
  }

  function updateQuery(value: string) {
    clearProviderSelection();
    setQuery(value);
    setError(undefined);
    if (shouldSearchPlaces(value.trim())) {
      setSearching(true);
    } else {
      setSuggestions([]);
      setSearching(false);
    }
  }

  function retrySearch() {
    if (!shouldSearchPlaces(query.trim())) return;
    sessionToken.current = undefined;
    setError(undefined);
    setSearching(true);
    setSearchAttempt((attempt) => attempt + 1);
  }

  const canSave = Boolean(name.trim()) && isCoordinateSelection(selection);
  return <form action={action} className="surface grid gap-4 rounded-[1.35rem] p-5">
    <input name="returnTo" type="hidden" value="/configuracoes/locais" />
    <input name="id" type="hidden" value={location?.id ?? ""} />
    <input name="placeProvider" type="hidden" value={selection?.placeProvider ?? ""} />
    <input name="providerPlaceId" type="hidden" value={selection?.providerPlaceId ?? ""} />
    <input name="providerSearchQuery" type="hidden" value={selection?.providerSearchQuery ?? ""} />
    <input name="formattedAddress" type="hidden" value={selection?.formattedAddress ?? ""} />
    <input name="latitude" type="hidden" value={selection?.latitude ?? ""} />
    <input name="longitude" type="hidden" value={selection?.longitude ?? ""} />
    <div><p className="eyebrow text-[var(--primary)]">REGISTRO PELO CELULAR</p><h2 className="font-display mt-1 text-3xl font-semibold leading-none">{location ? "Gerenciar localização" : "Novo local"}</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">Pesquise o endereço; as coordenadas continuam guardadas internamente para validar as batidas.</p></div>
    <label className="grid gap-1 text-sm font-medium">Unidade<select className="input" defaultValue={location?.unitId ?? ""} name="unitId" required><option value="">Selecione uma unidade</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm font-medium">Nome<input className="input" name="name" onChange={(event) => setName(event.target.value)} placeholder="Nome exibido do local" required value={name} /></label>
    <section aria-label="Localização" className="rounded-xl border bg-slate-50 p-4"><div className="flex items-start gap-3"><span className="grid size-9 place-items-center rounded-lg bg-orange-50 text-[var(--primary)]"><Search size={18} aria-hidden="true" /></span><div><h3 className="font-semibold">Localização</h3><p className="mt-1 text-sm text-[var(--muted-foreground)]">Pesquisar estabelecimento ou endereço</p></div></div><label className="mt-4 grid gap-1 text-sm font-medium"><span className="sr-only">Pesquisar estabelecimento ou endereço</span><input className="input" onChange={(event) => updateQuery(event.target.value)} placeholder="Ex.: Golden Shopping São Luís" value={query} /></label>{searching ? <p aria-live="polite" className="mt-3 flex items-center gap-2 text-sm text-slate-600"><InlineSpinner />Buscando locais…</p> : null}{resolving ? <p aria-live="polite" className="mt-3 flex items-center gap-2 text-sm text-slate-600"><InlineSpinner />Obtendo detalhes do local…</p> : null}{suggestions.length > 0 ? <ul className="mt-3 overflow-hidden rounded-lg border bg-white">{suggestions.map((suggestion) => <li className="border-b last:border-b-0" key={suggestion.providerPlaceId}><button className="w-full px-3 py-3 text-left hover:bg-orange-50" onClick={() => void chooseSuggestion(suggestion)} type="button"><span className="block font-semibold">{suggestion.displayName}</span><span className="mt-0.5 block text-sm text-[var(--muted-foreground)]">{suggestion.formattedAddress}</span></button></li>)}</ul> : null}{selection ? <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-950"><div className="flex items-start gap-2"><MapPin className="mt-0.5 shrink-0 text-emerald-700" size={18} aria-hidden="true" /><div><p className="font-semibold">{selection.method === "PLACE" ? name || "Local selecionado" : selection.method === "CURRENT_LOCATION" ? "Localização atual" : "Coordenadas manuais"}</p><p className="mt-1 whitespace-pre-line text-sm text-emerald-900">{selection.formattedAddress}</p><p className="mt-2 text-sm font-medium">Localização encontrada</p><a className="mt-2 inline-flex items-center gap-1 text-sm font-semibold underline" href={mapUrl(selection)} rel="noreferrer" target="_blank">Ver no mapa <ExternalLink size={14} aria-hidden="true" /></a></div></div></div> : <p className="mt-4 text-sm text-[var(--muted-foreground)]">Pesquise e selecione um local para continuar.</p>}<details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-[var(--primary)]">Outras formas de definir localização</summary><div className="mt-3 flex flex-wrap gap-2"><button className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-semibold" disabled={currentLocationLoading} onClick={useCurrentLocation} type="button"><LocateFixed size={16} aria-hidden="true" />{currentLocationLoading ? "Obtendo localização…" : "Usar minha localização atual"}</button><button className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-semibold" onClick={openManualCoordinates} type="button"><SlidersHorizontal size={16} aria-hidden="true" />Informar coordenadas manualmente</button></div>{manualOpen ? <div className="mt-3 grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm font-medium">Latitude<input className="input" onChange={(event) => updateManualCoordinate("latitude", event.target.value)} step="any" type="number" value={selection?.method === "MANUAL" ? selection.latitude : ""} /></label><label className="grid gap-1 text-sm font-medium">Longitude<input className="input" onChange={(event) => updateManualCoordinate("longitude", event.target.value)} step="any" type="number" value={selection?.method === "MANUAL" ? selection.longitude : ""} /></label></div> : null}</details><details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-slate-600">Detalhes técnicos</summary><p className="mt-2 font-mono text-xs text-slate-600">Latitude: {selection?.latitude || "—"}<br />Longitude: {selection?.longitude || "—"}</p></details><p className="mt-4 text-xs text-[var(--muted-foreground)]">Dados de localização © <a className="underline" href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">OpenStreetMap contributors</a></p></section>
    {error ? <ErrorState description={error} title="Não foi possível concluir a busca."><div className="flex flex-wrap gap-2"><RetryButton onClick={retrySearch}>Tentar novamente</RetryButton><button className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-100" onClick={useCurrentLocation} type="button">Usar minha localização</button><button className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-100" onClick={openManualCoordinates} type="button">Informar manualmente</button></div></ErrorState> : null}
    <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Raio permitido (m)<input className="input" defaultValue={location?.radiusMeters ?? 100} min="1" name="radiusMeters" required type="number" /></label><label className="grid gap-1 text-sm font-medium">Precisão máxima (m)<input className="input" defaultValue={location?.maxAccuracyMeters ?? 100} min="1" name="maxAccuracyMeters" required type="number" /></label></div>
    <label className="grid gap-1 text-sm font-medium">Fora do raio ou com baixa precisão<select className="input" defaultValue={location?.exceptionPolicy ?? "ALLOW_AND_REVIEW"} name="exceptionPolicy"><option value="ALLOW_AND_REVIEW">Permitir e enviar para revisão</option><option value="BLOCK">Bloquear registro</option></select></label>
    <label className="flex items-center gap-2 text-sm"><input defaultChecked={location?.active ?? true} name="active" type="checkbox" />Registro pelo celular ativo</label>
    <label className="grid gap-1 text-sm font-medium">Justificativa <span className="font-normal text-[var(--muted-foreground)]">(recomendada ao alterar)</span><textarea className="input min-h-20" name="reason" /></label>
    <LoadingButton disabled={!canSave} loadingLabel="Salvando localização…">{location ? "Salvar localização" : "Criar local"}</LoadingButton>
  </form>;
}
