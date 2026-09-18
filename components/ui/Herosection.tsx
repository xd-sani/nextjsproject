import Image from 'next/image'
import Link from 'next/link'
import { Plus } from 'lucide-react'

const steps = [
  { title: 'Upload PDF', description: 'Add your book file' },
  { title: 'AI Processing', description: 'We analyze the content' },
  { title: 'Voice Chat', description: 'Discuss with AI' },
]

export default function Herosection() {
  return (
    <main className="library-home">
      <section className="library-hero wrapper mb-10 md:mb-16" aria-labelledby="library-title">
        <div className="library-hero-copy">
          <div className="library-hero-heading">
            <h1 id="library-title">Your Library</h1>
            <p>
              Convert your books into interactive AI conversations. Listen,
              learn, and discuss your favorite reads.
            </p>
          </div>
          <Link className="library-hero-button" href="/books/new">
            <Plus aria-hidden="true" size={24} strokeWidth={2} />
            <span>Add new book</span>
          </Link>
        </div>

        <Image
          className="library-hero-art"
          src="/assets/Gemini_Generated_Image_jlix6fjlix6fjlix (1) 1.png"
          alt="Vintage books, a globe, and a reading lamp"
          width={422}
          height={352}
          priority
        />

        <ol className="library-hero-steps" aria-label="How it works">
          {steps.map((step, index) => (
            <li className="library-hero-step" key={step.title}>
              <span className="library-hero-number">{index + 1}</span>
              <div>
                <h2>{step.title}</h2>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}