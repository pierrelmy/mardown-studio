import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
export function Modal({
  title,
  children,
  close,
}: {
  title: string
  children: ReactNode
  close: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button onClick={close} title="Fermer" aria-label="Fermer la boîte de dialogue">
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
