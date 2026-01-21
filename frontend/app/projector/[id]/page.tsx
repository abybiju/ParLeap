import { ProjectorDisplay } from '@/components/projector/ProjectorDisplay'

interface ProjectorPageProps {
  params: {
    id: string
  }
}

/**
 * Projector View Page
 * 
 * Clean, full-screen display for projector/second screen
 * No authentication required - just needs eventId
 */
export default function ProjectorPage({ params }: ProjectorPageProps) {
  return <ProjectorDisplay eventId={params.id} />
}
