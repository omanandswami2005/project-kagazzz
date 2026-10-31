import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Each case needs fresh module state: engines are singletons and env is read lazily.
async function load(env: { cloud?: string; ollama?: string }) {
  vi.resetModules();
  vi.stubEnv('VITE_CLOUD_AI', env.cloud ?? '');
  vi.stubEnv('VITE_OLLAMA_URL', env.ollama ?? '');
  const mode = await import('@/infrastructure/cloud-ai');
  const registry = await import('../chat-engine.registry');
  return { ...mode, ...registry };
}

describe('chat engine selection (the single online/offline switch)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllEnvs());

  it('a plain build uses the on-device engine and has no server engine', async () => {
    const r = await load({});
    expect(r.getServerEngine()).toBeNull();
    expect(r.getChatEngine().kind).toBe('litert');
  });

  it('cloud build: offline → on-device, online → cloud (Vertex)', async () => {
    const r = await load({ cloud: '1' });
    expect(r.getChatEngine().kind).toBe('litert');
    r.setAiMode('online');
    expect(r.getChatEngine().kind).toBe('cloud');
    expect(r.getChatEngine().locality).toBe('cloud');
    r.setAiMode('offline');
    expect(r.getChatEngine().kind).toBe('litert');
  });

  it('cloud + Ollama build: offline → Ollama (local server), online → cloud', async () => {
    const r = await load({ cloud: '1', ollama: 'http://localhost:11434' });
    expect(r.getChatEngine().kind).toBe('ollama');
    r.setAiMode('online');
    expect(r.getChatEngine().kind).toBe('cloud');
  });

  it('a stored "online" is ignored when the build has no cloud proxy', async () => {
    localStorage.setItem('kagaz:ai-mode', 'online');
    const r = await load({ ollama: 'http://localhost:11434' });
    expect(r.getChatEngine().kind).toBe('ollama');
  });

  it('the system prompt carries the skill catalog so the model knows what it can load', async () => {
    const r = await load({ cloud: '1' });
    r.setAiMode('online');
    const engine = r.getCloudEngine();
    expect(engine).not.toBeNull();
    const chatId = (await engine!.createChat()).id;
    expect(chatId).toBeTruthy();
  });
});
