import { CoursesTabs } from '../components/CoursesTabs'
import { DiscountsManager } from '../components/DiscountsManager'

export const metadata = {
  title: 'Códigos de descuento | Apoteósicas',
}

export default function DiscountsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <CoursesTabs />
      <DiscountsManager />
    </div>
  )
}
