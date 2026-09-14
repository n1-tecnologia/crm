import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * O Next 16 recusa os recursos de desenvolvimento — inclusive o WebSocket de
   * HMR — quando a origem não está nesta lista, e sem HMR a árvore cliente não
   * hidrata: a interface fica de pé e não responde a clique nenhum.
   *
   * `localhost` já vale por padrão; estes dois são para abrir pelo IP da
   * máquina ou de outro aparelho na mesma rede.
   */
  allowedDevOrigins: ["127.0.0.1", "172.16.0.127"],
};

export default nextConfig;
