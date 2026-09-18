import BookCard from '@/components/ui/BookCard'
import Herosection from '@/components/ui/Herosection'
import { getAllBooks } from '@/lib/actions/book.actions';
import React from 'react'

const page = async() => {
  const bookResults=await getAllBooks()
  const books=bookResults.success ? bookResults.data ?? []:[]
  return (
    <main className='wrapper container'>
      <Herosection/>
      <div className='library-books-grid'>
        {
          books.map((book)=>(
            <BookCard key={book._id} title={book.title} author={book.author} coverURL={book.coverURL}
            slug={book.slug} />
          ))
        }
      </div>
    </main>
  )
}

export default page