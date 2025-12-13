import { useState } from 'react'

interface ShellyRGBW2ControlProps {
  sensorName: string
}

export default function ShellyRGBW2Control({ sensorName }: ShellyRGBW2ControlProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [colorValues, setColorValues] = useState({ red: 255, green: 255, blue: 255, white: 0 })
  const [brightness, setBrightness] = useState(50)

  const setLoadingState = (action: string, value: boolean) => {
    setLoading(prev => ({ ...prev, [action]: value }))
  }

  const callAPI = async (endpoint: string, body: any, actionName: string) => {
    setLoadingState(actionName, true)
    try {
      const response = await fetch(`http://localhost:8000/sensors/shelly-rgbw2${endpoint}`, {
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
      {/* Sezione COLOR */}
      <div className="p-4 rounded-lg border-2" style={{ 
        borderColor: '#8F0177',
        background: 'linear-gradient(135deg, rgba(143, 1, 119, 0.3), rgba(54, 1, 133, 0.2))'
      }}>
        <h4 className="text-sm font-bold mb-3" style={{ color: '#F4B342' }}>Controllo Colore (RGBW)</h4>
        
        {/* Controlli RGBW */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: '#FFFFFF', opacity: 0.9 }}>Rosso (0-255)</label>
            <input
              type="range"
              min="0"
              max="255"
              value={colorValues.red}
              onChange={(e) => setColorValues(prev => ({ ...prev, red: parseInt(e.target.value) }))}
              className="w-full"
              style={{ accentColor: '#DE1A58' }}
            />
            <div className="text-xs text-center mt-1" style={{ color: '#F4B342' }}>{colorValues.red}</div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#FFFFFF', opacity: 0.9 }}>Verde (0-255)</label>
            <input
              type="range"
              min="0"
              max="255"
              value={colorValues.green}
              onChange={(e) => setColorValues(prev => ({ ...prev, green: parseInt(e.target.value) }))}
              className="w-full"
              style={{ accentColor: '#4CAF50' }}
            />
            <div className="text-xs text-center mt-1" style={{ color: '#F4B342' }}>{colorValues.green}</div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#FFFFFF', opacity: 0.9 }}>Blu (0-255)</label>
            <input
              type="range"
              min="0"
              max="255"
              value={colorValues.blue}
              onChange={(e) => setColorValues(prev => ({ ...prev, blue: parseInt(e.target.value) }))}
              className="w-full"
              style={{ accentColor: '#2196F3' }}
            />
            <div className="text-xs text-center mt-1" style={{ color: '#F4B342' }}>{colorValues.blue}</div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#FFFFFF', opacity: 0.9 }}>Bianco (0-255)</label>
            <input
              type="range"
              min="0"
              max="255"
              value={colorValues.white}
              onChange={(e) => setColorValues(prev => ({ ...prev, white: parseInt(e.target.value) }))}
              className="w-full"
              style={{ accentColor: '#FFFFFF' }}
            />
            <div className="text-xs text-center mt-1" style={{ color: '#F4B342' }}>{colorValues.white}</div>
          </div>
        </div>

        {/* Anteprima colore */}
        <div className="mb-4 p-3 rounded-lg border-2" style={{ 
          borderColor: '#8F0177',
          backgroundColor: `rgb(${colorValues.red}, ${colorValues.green}, ${colorValues.blue})`,
          minHeight: '60px'
        }}>
          <div className="text-xs text-center" style={{ color: '#FFFFFF', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
            Anteprima Colore
          </div>
        </div>

        {/* Pulsanti controllo */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => callAPI('/color/turn-on', colorValues, 'color_on')}
            disabled={loading.color_on}
            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: loading.color_on 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #4CAF50, #45a049)',
              color: '#FFFFFF',
              opacity: loading.color_on ? 0.7 : 1
            }}
          >
            {loading.color_on ? '...' : 'Accendi'}
          </button>
          <button
            onClick={() => callAPI('/color/turn-off', {}, 'color_off')}
            disabled={loading.color_off}
            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: loading.color_off 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #DE1A58, #8F0177)',
              color: '#FFFFFF',
              opacity: loading.color_off ? 0.7 : 1
            }}
          >
            {loading.color_off ? '...' : 'Spegni'}
          </button>
          <button
            onClick={() => callAPI('/color/toggle', {}, 'color_toggle')}
            disabled={loading.color_toggle}
            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: loading.color_toggle 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #F4B342, #e6a63d)',
              color: '#FFFFFF',
              opacity: loading.color_toggle ? 0.7 : 1
            }}
          >
            {loading.color_toggle ? '...' : 'Toggle'}
          </button>
        </div>

        {/* Preset colori */}
        <div className="mt-4">
          <div className="text-xs mb-2" style={{ color: '#FFFFFF', opacity: 0.9 }}>Preset Colori:</div>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setColorValues({ red: 255, green: 0, blue: 0, white: 0 })}
              className="px-2 py-1 text-xs rounded border-2"
              style={{ borderColor: '#8F0177', backgroundColor: 'rgba(255, 0, 0, 0.3)', color: '#FFFFFF' }}
            >
              Rosso
            </button>
            <button
              onClick={() => setColorValues({ red: 0, green: 255, blue: 0, white: 0 })}
              className="px-2 py-1 text-xs rounded border-2"
              style={{ borderColor: '#8F0177', backgroundColor: 'rgba(0, 255, 0, 0.3)', color: '#FFFFFF' }}
            >
              Verde
            </button>
            <button
              onClick={() => setColorValues({ red: 0, green: 0, blue: 255, white: 0 })}
              className="px-2 py-1 text-xs rounded border-2"
              style={{ borderColor: '#8F0177', backgroundColor: 'rgba(0, 0, 255, 0.3)', color: '#FFFFFF' }}
            >
              Blu
            </button>
            <button
              onClick={() => setColorValues({ red: 255, green: 255, blue: 255, white: 255 })}
              className="px-2 py-1 text-xs rounded border-2"
              style={{ borderColor: '#8F0177', backgroundColor: 'rgba(255, 255, 255, 0.3)', color: '#FFFFFF' }}
            >
              Bianco
            </button>
          </div>
        </div>
      </div>

      {/* Sezione WHITE (canali individuali) */}
      <div className="p-4 rounded-lg border-2" style={{ 
        borderColor: '#8F0177',
        background: 'linear-gradient(135deg, rgba(143, 1, 119, 0.3), rgba(54, 1, 133, 0.2))'
      }}>
        <h4 className="text-sm font-bold mb-3" style={{ color: '#F4B342' }}>Controllo Canali (WHITE)</h4>
        
        <div className="mb-3">
          <label className="block text-xs mb-1" style={{ color: '#FFFFFF', opacity: 0.9 }}>Luminosità (0-100%)</label>
          <input
            type="range"
            min="0"
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
            onClick={() => callAPI('/white/set-brightness', { channel: 3, brightness }, 'white_brightness')}
            disabled={loading.white_brightness}
            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: loading.white_brightness 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #F4B342, #e6a63d)',
              color: '#FFFFFF',
              opacity: loading.white_brightness ? 0.7 : 1
            }}
          >
            {loading.white_brightness ? '...' : `Bianco ${brightness}%`}
          </button>
          <button
            onClick={() => callAPI('/white/turn-off', { channel: 3 }, 'white_off')}
            disabled={loading.white_off}
            className="px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: loading.white_off 
                ? 'linear-gradient(135deg, #8F0177, #360185)' 
                : 'linear-gradient(135deg, #DE1A58, #8F0177)',
              color: '#FFFFFF',
              opacity: loading.white_off ? 0.7 : 1
            }}
          >
            {loading.white_off ? '...' : 'Spegni Bianco'}
          </button>
        </div>
      </div>
    </div>
  )
}

