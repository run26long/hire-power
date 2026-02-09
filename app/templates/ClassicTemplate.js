export default function ClassicTemplate({ resume }) {
  return (
    <div className="w-[8.5in] min-h-[11in] bg-white mx-auto shadow-lg p-12">
      {/* Header - Center Aligned */}
      {resume.contact && (
        <div className="text-center mb-6 pb-4 border-b-2 border-gray-300">
          <h1 className="text-2xl font-bold tracking-wide mb-2">{resume.contact.fullName}</h1>
          <p className="text-xs text-gray-600">
            {resume.contact.phone} | {resume.contact.email}
          </p>
        </div>
      )}

      {/* Professional Summary */}
      {resume.summary && (
        <div className="mb-6">
          <h2 className="text-sm font-bold tracking-wider mb-2 text-gray-800">PROFESSIONAL OVERVIEW</h2>
          <p className="text-xs text-gray-700 leading-relaxed">{resume.summary}</p>
        </div>
      )}

      {/* Work Experience */}
      {resume.experience && resume.experience.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold tracking-wider mb-3 text-gray-800">WORK EXPERIENCE</h2>
          {resume.experience.map((job, index) => (
            <div key={index} className="mb-4">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className="font-bold text-xs">{job.title} | {job.company}</h3>
                <span className="text-xs text-gray-600">{job.startDate} - {job.endDate}</span>
              </div>
              {job.summary && (
                <p className="text-xs text-gray-600 italic mb-2">{job.summary}</p>
              )}
              {job.achievements && job.achievements.length > 0 && (
                <ul className="list-disc ml-5 space-y-1">
                  {job.achievements.map((achievement, i) => (
                    <li key={i} className="text-xs text-gray-700">{achievement}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {resume.education && resume.education.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold tracking-wider mb-3 text-gray-800">EDUCATION</h2>
          {resume.education.map((edu, index) => (
            <div key={index} className="mb-3">
              <div className="flex justify-between items-baseline">
                <div>
                  <h3 className="font-bold text-xs">{edu.degree}</h3>
                  <p className="text-xs text-gray-700">{edu.school}</p>
                  {edu.gpa && <p className="text-xs text-gray-600">GPA: {edu.gpa}</p>}
                </div>
                <span className="text-xs text-gray-600">{edu.graduationDate}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {resume.skills && resume.skills.length > 0 && (
        <div>
          <h2 className="text-sm font-bold tracking-wider mb-2 text-gray-800">SKILLS</h2>
          <div className="flex flex-wrap gap-2">
            {resume.skills.map((skill, index) => (
              <span key={index} className="bg-gray-100 px-3 py-1 rounded text-xs text-gray-700">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}