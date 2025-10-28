export type RunConfig = {
    readonly custom?: Record<string, unknown>;
};

export type StartRunConfig = {
    parentId: string | null;
    sourceId: string | null;
    runConfig: RunConfig;
};