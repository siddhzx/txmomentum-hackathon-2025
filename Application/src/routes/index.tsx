import { createFileRoute } from '@tanstack/react-router'
import HomePage from '../components/HomePage'
import Header from '../components/Header'

function IndexPage() {
  return (
    <div>
      <Header />
      <HomePage />
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: IndexPage,
})