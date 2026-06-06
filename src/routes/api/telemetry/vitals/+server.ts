import { vitalsEndpointHandler } from '@parallaxrealms/pxp-otel'

// Anonymous, first-party Web Vitals ingest — the browser POSTs here and the
// server forwards to the OTel collector. Payloads are validated/clamped by
// the handler; no user data involved.
export const POST = vitalsEndpointHandler()
