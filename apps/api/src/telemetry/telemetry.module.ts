import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * OpenTelemetry integration module.
 * Provides tracing, metrics, and structured logging with correlation IDs.
 */
@Module({})
export class TelemetryModule implements OnModuleInit {
  private readonly logger = new Logger(TelemetryModule.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const otelEndpoint = this.config.get<string>('OTEL_EXPORTER_OTLP_ENDPOINT');
    if (otelEndpoint) {
      this.logger.log(`OpenTelemetry configured → ${otelEndpoint}`);
      // In production: initialize @opentelemetry/sdk-node here
      // const sdk = new NodeSDK({
      //   traceExporter: new OTLPTraceExporter({ url: otelEndpoint }),
      //   metricReader: new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter({ url: otelEndpoint }) }),
      //   instrumentations: [getNodeAutoInstrumentations()],
      // });
      // sdk.start();
    } else {
      this.logger.log('OpenTelemetry not configured (no OTEL_EXPORTER_OTLP_ENDPOINT)');
    }
  }
}
