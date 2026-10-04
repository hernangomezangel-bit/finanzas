import { useEffect, type ReactNode } from 'react'

/** Panel que sube desde abajo, cómodo de usar con el pulgar. */
export default function Hoja({
  titulo,
  alCerrar,
  children,
}: {
  titulo: string
  alCerrar: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar()
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [alCerrar])

  return (
    <div className="fondo-hoja" onClick={alCerrar}>
      <div
        className="hoja"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hoja-cabecera">
          <h2>{titulo}</h2>
          <button className="cerrar" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
