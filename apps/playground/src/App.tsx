import { useState } from 'react';

const JOBS = [
  {
    id: 1,
    title: 'Senior Frontend Engineer',
    company: 'TechFlow Inc.',
    location: 'San Francisco, CA (Remote)',
    salary: '$140,000 - $180,000',
    description: 'We are looking for an experienced Frontend Engineer to build robust web automation interfaces.',
  },
  {
    id: 2,
    title: 'Data Scraping Specialist',
    company: 'DataWorks',
    location: 'New York, NY',
    salary: '$90,000 - $120,000',
    description: 'Join our team to extract and transform large datasets using automated browser workflows.',
  },
  {
    id: 3,
    title: 'Software Engineer in Test',
    company: 'QualityFirst',
    location: 'London, UK (Hybrid)',
    salary: '£70,000 - £95,000',
    description: 'Automate testing of our complex web applications to ensure seamless user experiences.',
  }
];

function App() {
  const [appliedJobs, setAppliedJobs] = useState<number[]>([]);

  const handleApply = (id: number) => {
    setAppliedJobs((prev) => [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Workflow Testing Ground</h1>
          <p className="text-lg text-gray-600">Use this dummy job board to test your Flowscript web automation workflows.</p>
        </header>

        <main>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul role="list" className="divide-y divide-gray-200">
              {JOBS.map((job) => (
                <li key={job.id} className="job-card px-4 py-6 sm:px-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h2 className="job-title text-xl font-bold text-blue-600 truncate mb-1">{job.title}</h2>
                      <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
                        <span className="job-company font-medium text-gray-900">{job.company}</span>
                        <span>•</span>
                        <span className="job-location">{job.location}</span>
                      </div>
                      <p className="job-description text-sm text-gray-600 mb-2">{job.description}</p>
                      <div className="job-salary text-sm font-semibold text-green-600 bg-green-50 inline-block px-2 py-1 rounded">
                        {job.salary}
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0 flex flex-col items-end gap-2">
                      <button
                        className={`apply-button inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                          appliedJobs.includes(job.id)
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                        }`}
                        onClick={() => handleApply(job.id)}
                        disabled={appliedJobs.includes(job.id)}
                      >
                        {appliedJobs.includes(job.id) ? 'Applied' : 'Apply Now'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
