import { AppProvider, useApp } from './state'
import { RemoveNode } from '../interactions/RemoveNode'
import { NetworkView } from '../visualization/NetworkView'

export function Scene() {
  const { state, dispatch } = useApp()
  if (state.load === 'loading') return <p role="status">Loading baseline</p>
  if (state.load === 'error' || !state.network || !state.result) return <p role="alert">Could not load data: {state.error}</p>
  return (
    <main>
      <h1>CASCADIA</h1>
      <NetworkView network={state.network} result={state.result.result} removedBus={state.removedBus}
        selectedBus={state.selectedBus} onSelect={bus => dispatch({ type: 'select', bus })} />
      <RemoveNode />
      <p className="provenance">{state.result.label}</p>
    </main>
  )
}

export default function App() {
  return <AppProvider><Scene /></AppProvider>
}
