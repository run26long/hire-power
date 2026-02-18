'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'
import { TIERS } from '@/lib/subscription'

export default function CareerArchive() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [achievements, setAchievements] = useState([])
  const [userTier, setUserTier] = useState(null)
  
  // Form state
  const [achievementText, setAchievementText] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [showDetails, setShowDetails] = useState(false)
  const [jobContext, setJobContext] = useState('')
  const [category, setCategory] = useState('')
  const [impactDetails, setImpactDetails] = useState('')
  const [skillsUsed, setSkillsUsed] = useState('')
  const [saving, setSaving] = useState(false)
  
  // Edit/Delete state
  const [editingAchievement, setEditingAchievement] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(null)
  
  // Search/Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  useEffect(() => {
    loadAchievements()
  }, [])

  async function loadAchievements() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // Check tier access
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()

      setUserTier(profile?.subscription_tier)

      // Load achievements
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (error) throw error

      setAchievements(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading achievements:', error)
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!achievementText.trim()) return

    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const achievementData = {
        user_id: user.id,
        achievement_text: achievementText,
        date: date,
        job_context: jobContext || null,
        category: category || null,
        impact_details: impactDetails || null,
        skills_used: skillsUsed || null
      }

      if (editingAchievement) {
        // Update existing
        const { error } = await supabase
          .from('achievements')
          .update(achievementData)
          .eq('id', editingAchievement.id)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('achievements')
          .insert(achievementData)

        if (error) throw error
      }

      // Reset form
      setAchievementText('')
      setDate(new Date().toISOString().split('T')[0])
      setJobContext('')
      setCategory('')
      setImpactDetails('')
      setSkillsUsed('')
      setShowDetails(false)
      setEditingAchievement(null)

      // Reload
      await loadAchievements()
    } catch (error) {
      console.error('Error saving achievement:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    try {
      const { error } = await supabase
        .from('achievements')
        .delete()
        .eq('id', id)

      if (error) throw error

      setShowDeleteModal(null)
      await loadAchievements()
    } catch (error) {
      console.error('Error deleting achievement:', error)
    }
  }

  function startEdit(achievement) {
    setEditingAchievement(achievement)
    setAchievementText(achievement.achievement_text)
    setDate(achievement.date)
    setJobContext(achievement.job_context || '')
    setCategory(achievement.category || '')
    setImpactDetails(achievement.impact_details || '')
    setSkillsUsed(achievement.skills_used || '')
    setShowDetails(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingAchievement(null)
    setAchievementText('')
    setDate(new Date().toISOString().split('T')[0])
    setJobContext('')
    setCategory('')
    setImpactDetails('')
    setSkillsUsed('')
    setShowDetails(false)
  }

  // Filter achievements
  const filteredAchievements = achievements.filter(a => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = (
        a.achievement_text?.toLowerCase().includes(searchLower) ||
        a.job_context?.toLowerCase().includes(searchLower) ||
        a.impact_details?.toLowerCase().includes(searchLower) ||
        a.skills_used?.toLowerCase().includes(searchLower)
      )
      if (!matchesSearch) return false
    }

    // Category filter
    if (filterCategory !== 'all') {
      if (a.category !== filterCategory) return false
    }

    return true
  })

  // Group by month
  const groupedAchievements = filteredAchievements.reduce((groups, achievement) => {
    const date = new Date(achievement.date)
    const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    
    if (!groups[monthYear]) {
      groups[monthYear] = []
    }
    groups[monthYear].push(achievement)
    
    return groups
  }, {})

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-12">
        
        {/* Header with stats */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🗂️ Career Archive</h1>
          <p className="text-gray-600">
            {achievements.length === 0 
              ? 'Start tracking your career wins as they happen'
              : `You've tracked ${achievements.length} achievement${achievements.length !== 1 ? 's' : ''} since joining Vault`
            }
          </p>
          {achievements.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Last added: {new Date(achievements[0].created_at).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Add Achievement Form */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">
            {editingAchievement ? '✏️ Edit Achievement' : '✨ Add New Achievement'}
          </h2>

          <div className="space-y-4">
            {/* Achievement text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What did you accomplish? *
              </label>
              <textarea
                value={achievementText}
                onChange={(e) => setAchievementText(e.target.value)}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Led team presentation, closed major deal, solved complex problem..."
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                When? *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Toggle details */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              {showDetails ? '▼ Hide Details' : '▶ Add Details (optional)'}
            </button>

            {/* Optional details */}
            {showDetails && (
              <div className="space-y-4 pt-4 border-t">
                {/* Job context */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Where did this happen?
                  </label>
                  <input
                    type="text"
                    value={jobContext}
                    onChange={(e) => setJobContext(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Universal Studios - Marketing Manager"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select category...</option>
                    <option value="work">Work Achievement</option>
                    <option value="skill">Skill Development</option>
                    <option value="education">Education/Certification</option>
                    <option value="project">Project</option>
                    <option value="award">Award/Recognition</option>
                    <option value="volunteer">Volunteer/Leadership</option>
                  </select>
                </div>

                {/* Impact */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Impact Details (metrics, numbers, results)
                  </label>
                  <textarea
                    value={impactDetails}
                    onChange={(e) => setImpactDetails(e.target.value)}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Increased revenue by 25%, saved 40 hours/week, managed $200K budget..."
                  />
                </div>

                {/* Skills */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skills Used
                  </label>
                  <textarea
                    value={skillsUsed}
                    onChange={(e) => setSkillsUsed(e.target.value)}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Leadership, Project Management, Python, Data Analysis..."
                  />
                </div>
              </div>
            )}

            {/* Save buttons */}
            <div className="flex gap-3 pt-4">
              {editingAchievement && (
                <button
                  onClick={cancelEdit}
                  className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!achievementText.trim() || saving}
                className="flex-1 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : editingAchievement ? 'Update Achievement' : 'Save Achievement'}
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        {achievements.length > 0 && (
          <div className="mb-6 flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="🔍 Search achievements..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="work">Work</option>
              <option value="skill">Skills</option>
              <option value="education">Education</option>
              <option value="project">Projects</option>
              <option value="award">Awards</option>
              <option value="volunteer">Volunteer</option>
            </select>
          </div>
        )}

        {/* Results count */}
        {(searchTerm || filterCategory !== 'all') && (
          <p className="text-sm text-gray-600 mb-4">
            Showing {filteredAchievements.length} of {achievements.length} achievements
          </p>
        )}

        {/* Achievement Feed */}
        {filteredAchievements.length === 0 && achievements.length > 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800">
              No achievements match your search. Try different keywords.
            </p>
          </div>
        )}

        {achievements.length === 0 && (
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-8 text-center">
            <p className="text-lg font-semibold text-purple-900 mb-2">
              No achievements yet - add your first!
            </p>
            <p className="text-purple-700 text-sm">
              Track your wins as they happen so you're always interview-ready.
            </p>
          </div>
        )}

        {Object.keys(groupedAchievements).map(monthYear => (
          <div key={monthYear} className="mb-8">
            <h3 className="text-lg font-bold text-gray-700 mb-4">
              {monthYear} ({groupedAchievements[monthYear].length})
            </h3>
            <div className="space-y-4">
              {groupedAchievements[monthYear].map(achievement => (
                <div key={achievement.id} className="bg-white rounded-lg shadow-sm border p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">
                        {new Date(achievement.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                        {achievement.job_context && ` • ${achievement.job_context}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(achievement)}
                        className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setShowDeleteModal(achievement)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Achievement text */}
                  <p className="text-gray-900 font-medium mb-2">
                    {achievement.achievement_text}
                  </p>

                  {/* Optional details */}
                  {achievement.category && (
                    <p className="text-xs text-purple-600 font-medium mb-1">
                      Category: {achievement.category.charAt(0).toUpperCase() + achievement.category.slice(1)}
                    </p>
                  )}
                  {achievement.impact_details && (
                    <p className="text-sm text-gray-700 mb-1">
                      <span className="font-semibold">Impact:</span> {achievement.impact_details}
                    </p>
                  )}
                  {achievement.skills_used && (
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Skills:</span> {achievement.skills_used}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl border-2 border-purple-300">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Delete Achievement?</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this achievement? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteModal.id)}
                className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}