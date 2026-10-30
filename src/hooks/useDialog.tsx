import { useRef, useState } from 'react'
import { Modal } from '../components/Modal'
export type Choice = { label: string; value: string; primary?: boolean; danger?: boolean }
interface Request { title: string; message?: string; input?: string; choices: Choice[] }
export function useDialog() {
  const [request, setRequest] = useState<Request | null>(null)
  const [value, setValue] = useState('')
  const resolver = useRef<((result: string | null) => void) | null>(null)
  const ask = (request: Request): Promise<string | null> => {
    resolver.current?.(null)
    setValue(request.input ?? '')
    setRequest(request)
    return new Promise(resolve => { resolver.current = resolve })
  }
  const finish = (result: string | null) => { setRequest(null); resolver.current?.(result); resolver.current = null }
  const dialog = request && <Modal title={request.title} close={() => finish(null)}><form onSubmit={event => { event.preventDefault(); finish(request.input !== undefined ? value : request.choices.find(choice => choice.primary)?.value ?? null) }}>
    {request.message && <p>{request.message}</p>}{request.input !== undefined && <label>Nom<input aria-label="Nom" autoFocus value={value} onChange={event => setValue(event.target.value)} required maxLength={200} /></label>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={() => finish(null)}>Annuler</button>{request.choices.map(choice => <button key={choice.value} type="button" className={choice.primary ? 'primary' : choice.danger ? 'secondary danger' : 'secondary'} onClick={() => finish(request.input !== undefined ? value : choice.value)}>{choice.label}</button>)}</div>
  </form></Modal>
  return { ask, dialog }
}
export type Ask = ReturnType<typeof useDialog>['ask']
