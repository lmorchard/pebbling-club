export type MinimalLogBuilder = {
  child: (data: Record<string, any>) => MinimalLogger;
};

export type MinimalLogger = {
  debug: (data: Record<string, any>) => void;
  info: (data: Record<string, any>) => void;
  trace: (data: Record<string, any>) => void;
};
