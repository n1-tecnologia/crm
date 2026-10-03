import { Composition, registerRoot } from "remotion";
import { GuiaDoFinanceiro, type PropsDoVideo } from "./Gravacao";
import { FPS, duracaoDoVideo, type Roteiro } from "./linha-do-tempo";

const VAZIO: Roteiro = { largura: 1440, altura: 900, escala: 1.5, quadros: [], cursor: [], cliques: [], marcas: [], duracao: 1 };

function Raiz() {
  return (
    <Composition
      id="GuiaDoFinanceiro"
      component={GuiaDoFinanceiro}
      fps={FPS}
      width={1440}
      height={900}
      durationInFrames={FPS * 10}
      defaultProps={{ roteiro: VAZIO } satisfies PropsDoVideo}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.round(duracaoDoVideo(props.roteiro) * FPS) })}
    />
  );
}

registerRoot(Raiz);
