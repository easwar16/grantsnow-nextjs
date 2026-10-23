// Abort is best-effort; generation checking also rejects late completed responses.
export class LatestRequest {
  private generation = 0;
  private controller?: AbortController;
  begin() {
    this.controller?.abort();
    this.controller = new AbortController();
    const generation = ++this.generation;
    return {
      signal: this.controller.signal,
      current: () =>
        generation === this.generation && !this.controller!.signal.aborted,
    };
  }
  cancel() {
    this.controller?.abort();
    ++this.generation;
  }
}
