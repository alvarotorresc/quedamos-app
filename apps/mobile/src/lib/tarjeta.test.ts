import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aroArcAngles } from './aro-geometry';
import {
  renderTarjetaCerrada,
  renderTarjetaSellada,
  type TarjetaCerradaOpts,
  type TarjetaSelladaOpts,
} from './tarjeta';

const MEMBER_COLORS = ['#60A5FA', '#F59E0B', '#F472B6', '#34D399', '#A78BFA', '#FB7185'];

interface MockCtx {
  fillRect: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  translate: ReturnType<typeof vi.fn>;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  font: string;
  textAlign: string;
  textBaseline: string;
}

function createMockCtx(): MockCtx {
  return {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
  };
}

let mockCtx: MockCtx;
let getContextSpy: ReturnType<typeof vi.spyOn>;
let toBlobSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockCtx = createMockCtx();
  getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D);
  toBlobSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation(function toBlobMock(
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
    ) {
      callback(new Blob(['fake-png-bytes'], { type: type ?? 'image/png' }));
    });
});

afterEach(() => {
  getContextSpy.mockRestore();
  toBlobSpy.mockRestore();
});

const baseCerradaOpts: TarjetaCerradaOpts = {
  weekdayLabel: 'sábado',
  dayNumber: '14',
  titulo: 'El aro se ha cerrado.',
  subtitulo: 'Podéis los seis el sábado 14.',
  memberColors: MEMBER_COLORS,
  theme: 'dia',
  marca: '¿Quedamos?',
};

const baseSelladaOpts: TarjetaSelladaOpts = {
  titulo: 'Quedamos.',
  plan: 'Cena en casa de Iris',
  fechaHora: 'sábado 14 · 21:00',
  memberColors: MEMBER_COLORS,
  theme: 'dia',
  marca: '¿Quedamos?',
};

describe('renderTarjetaCerrada', () => {
  it('dibuja exactamente n arcos de miembro con el startRad esperado en el slot 0', async () => {
    await renderTarjetaCerrada(baseCerradaOpts);

    const n = MEMBER_COLORS.length;
    const memberArcCalls = mockCtx.arc.mock.calls.filter((call) => call[2] === 240);
    expect(memberArcCalls).toHaveLength(n);

    const { startRad, endRad } = aroArcAngles(n, 0, 240, { strokeWidth: 32 });
    const [, , , actualStart, actualEnd] = memberArcCalls[0] as number[];
    expect(actualStart).toBeCloseTo(startRad, 6);
    expect(actualEnd).toBeCloseTo(endRad, 6);
  });

  it('usa el strokeStyle de cada miembro en orden de slot (subsecuencia contigua)', async () => {
    const strokeStyleValues: string[] = [];
    Object.defineProperty(mockCtx, 'strokeStyle', {
      get: () => strokeStyleValues[strokeStyleValues.length - 1] ?? '',
      set: (v: string) => {
        strokeStyleValues.push(v);
      },
    });
    await renderTarjetaCerrada(baseCerradaOpts);
    const joined = strokeStyleValues.join('|');
    expect(joined).toContain(MEMBER_COLORS.join('|'));
  });

  it('tema noche: fillRect cubre el lienzo con fillStyle #14120E', async () => {
    const fillStyleValues: string[] = [];
    Object.defineProperty(mockCtx, 'fillStyle', {
      get: () => fillStyleValues[fillStyleValues.length - 1] ?? '',
      set: (v: string) => {
        fillStyleValues.push(v);
      },
    });
    await renderTarjetaCerrada({ ...baseCerradaOpts, theme: 'noche' });
    expect(fillStyleValues[0]).toBe('#14120E');
    expect(mockCtx.fillRect.mock.calls[0]).toEqual([0, 0, 1080, 1080]);
  });

  it('tema día: fillRect cubre el lienzo con fillStyle #F5F1E8', async () => {
    const fillStyleValues: string[] = [];
    Object.defineProperty(mockCtx, 'fillStyle', {
      get: () => fillStyleValues[fillStyleValues.length - 1] ?? '',
      set: (v: string) => {
        fillStyleValues.push(v);
      },
    });
    await renderTarjetaCerrada({ ...baseCerradaOpts, theme: 'dia' });
    expect(fillStyleValues[0]).toBe('#F5F1E8');
    expect(mockCtx.fillRect.mock.calls[0]).toEqual([0, 0, 1080, 1080]);
  });

  it('resuelve un Blob de tipo image/png vía toBlob', async () => {
    const blob = await renderTarjetaCerrada(baseCerradaOpts);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(toBlobSpy).toHaveBeenCalledTimes(1);
    expect(toBlobSpy.mock.calls[0][1]).toBe('image/png');
  });

  it('usa lineCap redondeado para los arcos del aro central', async () => {
    const lineCapValues: string[] = [];
    Object.defineProperty(mockCtx, 'lineCap', {
      get: () => lineCapValues[lineCapValues.length - 1] ?? '',
      set: (v: string) => {
        lineCapValues.push(v);
      },
    });
    await renderTarjetaCerrada(baseCerradaOpts);
    expect(lineCapValues.length).toBeGreaterThan(0);
    expect(lineCapValues.every((v) => v === 'round')).toBe(true);
  });

  it('respeta memberColors de longitud distinta de 6', async () => {
    const fewer = ['#60A5FA', '#F59E0B', '#F472B6'];
    await renderTarjetaCerrada({ ...baseCerradaOpts, memberColors: fewer });
    const memberArcCalls = mockCtx.arc.mock.calls.filter((call) => call[2] === 240);
    expect(memberArcCalls).toHaveLength(3);
  });
});

describe('renderTarjetaSellada', () => {
  it('dibuja el check (moveTo + 2 lineTo con las coordenadas del artboard escaladas x2)', async () => {
    await renderTarjetaSellada(baseSelladaOpts);

    const moveToCalls = mockCtx.moveTo.mock.calls;
    const lineToCalls = mockCtx.lineTo.mock.calls;

    expect(moveToCalls).toContainEqual([-80, 8]);
    expect(lineToCalls).toContainEqual([-24, 64]);
    expect(lineToCalls).toContainEqual([92, -60]);
  });

  it('pinta el texto del título', async () => {
    await renderTarjetaSellada(baseSelladaOpts);
    const texts = mockCtx.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toContain('Quedamos.');
  });

  it('dibuja el aro cerrado (todos los miembros en anillo continuo)', async () => {
    await renderTarjetaSellada(baseSelladaOpts);
    const memberArcCalls = mockCtx.arc.mock.calls.filter((call) => call[2] === 240);
    expect(memberArcCalls).toHaveLength(MEMBER_COLORS.length);
  });

  it('resuelve un Blob de tipo image/png', async () => {
    const blob = await renderTarjetaSellada(baseSelladaOpts);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
  });

  it('tema noche: fillRect de fondo cubre todo el lienzo', async () => {
    await renderTarjetaSellada({ ...baseSelladaOpts, theme: 'noche' });
    expect(mockCtx.fillRect.mock.calls[0]).toEqual([0, 0, 1080, 1080]);
  });
});

describe('getContext nulo', () => {
  it('lanza un error explícito si el canvas no da contexto 2D', async () => {
    getContextSpy.mockReturnValue(null);
    await expect(renderTarjetaCerrada(baseCerradaOpts)).rejects.toThrow();
  });
});
