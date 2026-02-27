export default function BatteryScore({ score, label, size = 'medium' }) {
  // Size variants
  const sizes = {
    small: { width: 'w-16', height: 'h-8', text: 'text-xs' },
    medium: { width: 'w-24', height: 'h-12', text: 'text-sm' },
    large: { width: 'w-32', height: 'h-16', text: 'text-base' }
  }
  
  const { width, height, text } = sizes[size]
  
  // Color based on score (matches job match thresholds)
  const getColor = () => {
    if (score >= 85) return 'bg-green-500'
    if (score >= 70) return 'bg-yellow-500'
    return 'bg-orange-500'
  }
  
  const fillWidth = `${score}%`
  
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Battery Container */}
      <div className="relative flex items-center">
        {/* Battery Body */}
        <div className={`${width} ${height} border-2 border-gray-700 rounded-md bg-white relative overflow-hidden`}>
          {/* Fill */}
          <div 
            className={`h-full ${getColor()} transition-all duration-500`}
            style={{ width: fillWidth }}
          />
          {/* Score Text */}
          <div className={`absolute inset-0 flex items-center justify-center ${text} font-bold text-gray-900`}>
            {score}
          </div>
        </div>
        
        {/* Battery Terminal */}
        <div className="w-1 h-6 bg-gray-700 rounded-r"></div>
        
      </div>
      
      {/* Label */}
      {label && (
        <p className="text-xs text-gray-600 font-medium">{label}</p>
      )}
    </div>
  )
}