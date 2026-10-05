import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';

interface VideoPlayerProps {
  /** Embed liberado pelo servidor (`CourseLesson.embed_url`). */
  embedUrl: string | null;
  title: string;
  /**
   * Segundos assistidos, para o heartbeat de progresso.
   *
   * É tempo de relógio, não posição do vídeo: o iframe é cross-origin e o
   * YouTube/Vimeo só entregam o tempo real via SDK próprio (IFrame API /
   * Player.js), que não está carregado aqui. Serve para "a pessoa estava
   * assistindo" e não para "parou em 7m12s" — a conclusão da aula vem do
   * `onEnded`.
   */
  onTimeUpdate?: (seconds: number) => void;
  onEnded?: () => void;
  /** Segundos de onde retomar; só faz sentido quando o aluno está inscrito. */
  startAtSeconds?: number;
  autoStart?: boolean;
  className?: string;
}

/**
 * Player de aula.
 *
 * O `embedUrl` vem pronto do backend e só vem preenchido quando a aula está
 * liberada (`locked === false`). Não há montagem de URL de YouTube aqui de
 * propósito: se o servidor não mandou embed, o aluno não consegue montar o
 * embed na mão e assistir o que não pagou.
 */
export const VideoPlayer = ({
  embedUrl,
  title,
  onTimeUpdate,
  onEnded,
  startAtSeconds = 0,
  autoStart = false,
  className,
}: VideoPlayerProps) => {
  const startedAtRef = useRef<number | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  const secondsWatched = useCallback((): number => {
    if (startedAtRef.current === null) return 0;
    return Math.round((Date.now() - startedAtRef.current) / 1000);
  }, []);

  useEffect(() => {
    startedAtRef.current = Date.now();

    // O heartbeat só faz sentido com destino: sem `onTimeUpdate` não há para quem
    // mandar, e o intervalo seria trabalho inútil a cada 15s.
    if (!onTimeUpdate || !embedUrl) return undefined;

    const interval = setInterval(() => onTimeUpdateRef.current?.(secondsWatched()), 15_000);
    return () => clearInterval(interval);
  }, [embedUrl, onTimeUpdate, secondsWatched]);

  // Sem embed o componente mostra o motivo, não um retângulo preto: o aluno
  // precisa saber que é o acesso, não um vídeo quebrado.
  if (!embedUrl) {
    return (
      <div
        className={cn(
          'flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg bg-muted text-center',
          className
        )}
      >
        <p className="text-sm font-medium">Aula não liberada</p>
        <p className="max-w-sm px-4 text-xs text-muted-foreground">
          Este conteúdo faz parte do curso. Assim que o vendedor liberar seu acesso, ela aparece aqui.
        </p>
      </div>
    );
  }

  const src = startAtSeconds > 0 ? `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}start=${startAtSeconds}` : embedUrl;

  return (
    <div className={cn('aspect-video w-full overflow-hidden rounded-lg bg-black', className)}>
      <iframe
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        autoPlay={autoStart}
        className="h-full w-full"
        onEnded={onEnded}
      />
    </div>
  );
};

export default VideoPlayer;