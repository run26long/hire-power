export default function ProfessionalTemplate({ resume }) {
  return (
    <div className="w-[8.5in] min-h-[11in] bg-white mx-auto shadow-lg border-4 border-purple-600 p-10">
      {/* Header - Center Aligned */}
      {resume.contact && (
        <div className="text-center mb-6 pb-4 border-b border-gray-300">
          <h1 className="text-xl font-bold tracking-wide mb-1">{resume.contact.fullName}</h1>
          <p className="text-xs text-gray-600">
            {resume.contact.phone} • {resume.contact.email}
          </p>
        </div>
      )}

      <div className="flex gap-8">
        {/* Left Column */}
        <div className="w-1/3">
          {/* Education */}
          {resume.education && resume.education.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-bold tracking-wider mb-3 text-purple-700 border-b border-purple-200 pb-1">EDUCATION</h2>
              {resume.education.map((edu, index) => (
                <div key={index} className="mb-4 text-xs">
                  <p className="font-semibold text-gray-800">{edu.degree}</p>
                  <p className="text-gray-600">{edu.school}</p>
                  <p className="text-gray-500">{edu.graduationDate}</p>
                  {edu.gpa && <p className="text-gray-600 mt-1">GPA: {edu.gpa}</p>}
                  {edu.honors && <p className="text-gray-600 mt-1 italic">{edu.honors}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Skills */}
          {resume.skills && resume.skills.length > 0 && (
            <div>
              <h2 className="text-xs font-bold tracking-wider mb-3 text-purple-700 border-b border-purple-200 pb-1">SKILLS</h2>
              <div className="space-y-2">
                {resume.skills.map((skill, index) => (
                  <div key={index} className="bg-purple-50 px-2 py-1.5 rounded text-xs text-gray-700">
                    {skill}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="flex-1">
          {/* Career Summary */}
          {resume.summary && (
            <div className="mb-6">
              <h2 className="text-xs font-bold tracking-wider mb-3 text-purple-700 border-b border-purple-200 pb-1">CAREER SUMMARY</h2>
              <p className="text-xs text-gray-700 leading-relaxed">{resume.summary}</p>
            </div>
          )}

          {/* Work Experience */}
          {resume.experience && resume.experience.length > 0 && (
            <div>
              <h2 className="text-xs font-bold tracking-wider mb-3 text-purple-700 border-b border-purple-200 pb-1">WORK EXPERIENCE</h2>
              {resume.experience.map((job, index) => (
                <div key={index} className="mb-5">
                  <h3 className="font-bold text-xs text-gray-800">{job.title}</h3>
                  <p className="text-xs text-gray-600 mb-1">{job.company} | {job.startDate} - {job.endDate}</p>
                  {job.summary && (
                    <p className="text-xs text-gray-600 italic mb-2">{job.summary}</p>
                  )}
                  {job.achievements && job.achievements.length > 0 && (
                    <ul className="space-y-1">
                      {job.achievements.map((achievement, i) => (
                        <li key={i} className="text-xs text-gray-700 ml-3 relative before:content-['•'] before:absolute before:-left-3 before:text-purple-600">
                          {achievement}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}