export const BENCHMARK_RESULT_VERSION = "v1" as const;

export interface BenchmarkMeasurementV1 {
  averageMs: number;
  iterations: number;
  maxMs: number;
  minMs: number;
  name: string;
  totalMs: number;
}

export interface BenchmarkResultV1 {
  generatedAt: number;
  measurements: BenchmarkMeasurementV1[];
  suite: string;
  version: typeof BENCHMARK_RESULT_VERSION;
}
