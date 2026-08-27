// The one error a backend raises when it refuses to write.
//
// A save that fails because the network died and a save that fails because this
// tab's data is out of date need opposite responses: retry the first, and NEVER
// retry the second — retrying a stale write is just asking to overwrite newer
// data again. So the refusal carries its own type, and the banner keys off it
// to offer Reload instead of Retry.
//
// `stale` is duplicated as a plain property because the check has to survive
// anything that reshapes the error on its way to the UI (a wrapper, a
// structured clone, a different module instance in a test).

export class StaleWriteError extends Error {
  constructor(key) {
    super(
      `"${key}" changed somewhere else after this page loaded, so it wasn't overwritten. Reload to get the latest.`
    );
    this.name = "StaleWriteError";
    this.stale = true;
    this.key = key;
  }
}

export const isStaleWrite = (e) => e?.stale === true || e?.name === "StaleWriteError";
