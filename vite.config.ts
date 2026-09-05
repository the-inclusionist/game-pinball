import { defineConfig } from 'vitest/config'; // nao de 'vite': e o vitest/config que tipa o campo `test`
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// POR QUE A RAIZ DO VITE E `app/` E NAO O REPOSITORIO
// Mesma razao do tracer: o que e PUBLICAVEL fica dentro de `app/`, e tudo o mais
// (scripts, testes, docs) fica fora do alcance do servidor por CONSTRUCAO, e nao
// por uma regra de exclusao que alguem precisa lembrar de manter.
//
// POR QUE SO O PROJETO `node` POR ENQUANTO
// As fases 1 a 5 do plano sao logica pura — parser do .DAT, matematica, colisao,
// maquina de missoes. Nada disso toca DOM. O projeto `browser` (Playwright) entra
// na fase 2, junto com o primeiro pixel desenhado, porque um projeto de browser
// configurado antes de existir o que ele testa e um gate que nunca ficou vermelho.
// ============================================================================
export default defineConfig({
  root: join(RAIZ, 'app'),
  build: { outDir: join(RAIZ, 'dist'), emptyOutDir: true },
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['../tests/**/*.node.test.ts'], // relativo a `root` (app/): o glob do tinyglobby quer barra normal, e join() devolve barra invertida no Windows
        },
      },
    ],
  },
});
