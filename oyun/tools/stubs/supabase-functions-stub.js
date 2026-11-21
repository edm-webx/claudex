// PRF-11: oyun Edge Functions kullanmaz. Boş taslak ~3 KB kazandırır.
export class FunctionsClient { constructor() { throw new Error('Functions bu pakette yok'); } }
export class FunctionsError extends Error {}
export class FunctionsFetchError extends FunctionsError {}
export class FunctionsHttpError extends FunctionsError {}
export class FunctionsRelayError extends FunctionsError {}
export const FunctionRegion = {};
