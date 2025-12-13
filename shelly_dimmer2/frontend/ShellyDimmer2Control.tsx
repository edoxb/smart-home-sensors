import { useState } from 'react'

interface ShellyDimmer2ControlProps {
  sensorName: string
}

export default function ShellyDimmer2Control({ sensorName }: ShellyDimmer2ControlProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [brightness, setBrightness] = useState(50)
  const [dimStep, setDimStep] = useState(10)

  const setLoadingState = (action: string, value: boolean) => {
    setLoading(prev => ({ ...prev, [action]: value }))
  }

  const callAPI = async (endpoint: string, body: any, actionName: string) => {
    setLoadingState(actionName, true)
    try {
      const response = await fetch(`http://localhost:8000/sensors/shelly-dimmer2${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensor_name: sensorName, ...body })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Errore nella richiesta')
      }
      
      const result = await response.json()
      console.log('Risultato:', result)
    } catch (error) {
      console.error('Errore:', error)
      alert(error instanceof Error ? error.message : 'Errore sconosciuto')
    } finally {
      setLoadingState(actionName, false)
    }
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Sezione Controllo Base */}
      <div className="p-4 rounded-lg border-2" style={{ 
        borderColor: '#8F0177',
        background: 'linear-gradient(135deg, rgba(143, 1, 119, 0.3), rgba(54, 1, 133, 0.2))'
      }}>
        <h4 className="text-sm font-bold mb-3" style={{ color: '#F4B342' }}>Controllo Luce</h4>
        
        {/* Pulsanti controllo */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            onClick={() => callAPI('/light/turn-on', { brightness }, 'light_on')}
            disabled={loading.light_on}
            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: loading.light_on 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #4CAF50, #45a049)',
              color: '#FFFFFF',
              opacity: loading.light_on ? 0.7 : 1
            }}
          >
            {loading.light_on ? '...' : 'Accendi'}
          </button>
          <button
            onClick={() => callAPI('/light/turn-off', {}, 'light_off')}
            disabled={loading.light_off}
            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: loading.light_off 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #DE1A58, #8F0177)',
              color: '#FFFFFF',
              opacity: loading.light_off ? 0.7 : 1
            }}
          >
            {loading.light_off ? '...' : 'Spegni'}
          </button>
          <button
            onClick={() => callAPI('/light/toggle', {}, 'light_toggle')}
            disabled={loading.light_toggle}
            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: loading.light_toggle 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #F4B342, #e6a63d)',
              color: '#FFFFFF',
              opacity: loading.light_toggle ? 0.7 : 1
            }}
          >
            {loading.light_toggle ? '...' : 'Toggle'}
          </button>
        </div>
      </div>

      {/* Sezione Luminosità */}
      <div className="p-4 rounded-lg border-2" style={{ 
        borderColor: '#8F0177',
        background: 'linear-gradient(135deg, rgba(143, 1, 119, 0.3), rgba(54, 1, 133, 0.2))'
      }}>
        <h4 className="text-sm font-bold mb-3" style={{ color: '#F4B342' }}>Luminosità</h4>
        
        <div className="mb-3">
          <label className="block text-xs mb-1" style={{ color: '#FFFFFF', opacity: 0.9 }}>Luminosità (1-100%)</label>
          <input
            type="range"
            min="1"
            max="100"
            value={brightness}
            onChange={(e) => setBrightness(parseInt(e.target.value))}
            className="w-full"
            style={{ accentColor: '#F4B342' }}
          />
          <div className="text-xs text-center mt-1" style={{ color: '#F4B342' }}>{brightness}%</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => callAPI('/light/set-brightness', { brightness }, 'set_brightness')}
            disabled={loading.set_brightness}
            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: loading.set_brightness 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #F4B342, #e6a63d)',
              color: '#FFFFFF',
              opacity: loading.set_brightness ? 0.7 : 1
            }}
          >
            {loading.set_brightness ? '...' : `Imposta ${brightness}%`}
          </button>
          <button
            onClick={() => callAPI('/light/turn-on', { brightness }, 'turn_on_brightness')}
            disabled={loading.turn_on_brightness}
            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: loading.turn_on_brightness 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #4CAF50, #45a049)',
              color: '#FFFFFF',
              opacity: loading.turn_on_brightness ? 0.7 : 1
            }}
          >
            {loading.turn_on_brightness ? '...' : `Accendi ${brightness}%`}
          </button>
        </div>

        {/* Preset luminosità */}
        <div className="mt-4">
          <div className="text-xs mb-2" style={{ color: '#FFFFFF', opacity: 0.9 }}>Preset Luminosità:</div>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setBrightness(25)}
              className="px-2 py-1 text-xs rounded border-2"
              style={{ borderColor: '#8F0177', backgroundColor: 'rgba(244, 179, 66, 0.3)', color: '#FFFFFF' }}
            >
              25%
            </button>
            <button
              onClick={() => setBrightness(50)}
              className="px-2 py-1 text-xs rounded border-2"
              style={{ borderColor: '#8F0177', backgroundColor: 'rgba(244, 179, 66, 0.3)', color: '#FFFFFF' }}
            >
              50%
            </button>
            <button
              onClick={() => setBrightness(75)}
              className="px-2 py-1 text-xs rounded border-2"
              style={{ borderColor: '#8F0177', backgroundColor: 'rgba(244, 179, 66, 0.3)', color: '#FFFFFF' }}
            >
              75%
            </button>
            <button
              onClick={() => setBrightness(100)}
              className="px-2 py-1 text-xs rounded border-2"
              style={{ borderColor: '#8F0177', backgroundColor: 'rgba(244, 179, 66, 0.3)', color: '#FFFFFF' }}
            >
              100%
            </button>
          </div>
        </div>
      </div>

      {/* Sezione Dimming Progressivo */}
      <div className="p-4 rounded-lg border-2" style={{ 
        borderColor: '#8F0177',
        background: 'linear-gradient(135deg, rgba(143, 1, 119, 0.3), rgba(54, 1, 133, 0.2))'
      }}>
        <h4 className="text-sm font-bold mb-3" style={{ color: '#F4B342' }}>Dimming Progressivo</h4>
        
        <div className="mb-3">
          <label className="block text-xs mb-1" style={{ color: '#FFFFFF', opacity: 0.9 }}>Step (1-100%)</label>
          <input
            type="range"
            min="1"
            max="100"
            value={dimStep}
            onChange={(e) => setDimStep(parseInt(e.target.value))}
            className="w-full"
            style={{ accentColor: '#F4B342' }}
          />
          <div className="text-xs text-center mt-1" style={{ color: '#F4B342' }}>{dimStep}%</div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => callAPI('/light/dim', { direction: 'up', step: dimStep }, 'dim_up')}
            disabled={loading.dim_up}
            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: loading.dim_up 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #4CAF50, #45a049)',
              color: '#FFFFFF',
              opacity: loading.dim_up ? 0.7 : 1
            }}
          >
            {loading.dim_up ? '...' : '↑ Up'}
          </button>
          <button
            onClick={() => callAPI('/light/dim', { direction: 'down', step: dimStep }, 'dim_down')}
            disabled={loading.dim_down}
            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: loading.dim_down 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #DE1A58, #8F0177)',
              color: '#FFFFFF',
              opacity: loading.dim_down ? 0.7 : 1
            }}
          >
            {loading.dim_down ? '...' : '↓ Down'}
          </button>
          <button
            onClick={() => callAPI('/light/dim', { direction: 'stop' }, 'dim_stop')}
            disabled={loading.dim_stop}
            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: loading.dim_stop 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #F4B342, #e6a63d)',
              color: '#FFFFFF',
              opacity: loading.dim_stop ? 0.7 : 1
            }}
          >
            {loading.dim_stop ? '...' : 'Stop'}
          </button>
        </div>
      </div>
    </div>
  )
}

