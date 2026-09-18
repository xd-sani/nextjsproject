import { auth } from "@clerk/nextjs/server";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getBookBySlug } from "@/lib/actions/book.actions";
import DograhVoiceAssistant from "@/components/DograhVoiceAssistant";

interface BookPageProps {
  params: Promise<{ slug: string }>;
}

const BookPage = async ({ params }: BookPageProps) => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  const { slug } = await params;
  const bookResult = await getBookBySlug(slug);

  if (!bookResult.success || !bookResult.data) {
    redirect("/");
  }

  const { title, author, coverURL } = bookResult.data;

  return (
    <main className="book-page-container">
      <Link href="/" className="back-btn-floating" aria-label="Back to library">
        <ArrowLeft aria-hidden="true" />
      </Link>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <section className="vapi-header-card">
          <div className="vapi-cover-wrapper">
            <Image
              src={coverURL}
              alt={`Cover of ${title}`}
              width={162}
              height={240}
              className="vapi-cover-image"
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <h1 className="font-serif text-2xl font-bold leading-tight text-black sm:text-3xl">
                {title}
              </h1>
              <p className="mt-1 text-base text-[#3d485e] sm:text-lg">
                by {author}
              </p>
            </div>
          </div>
        </section>

        <DograhVoiceAssistant
          bookId={bookResult.data._id}
          bookName={bookResult.data.title}
        />
      </div>
    </main>
  );
};

export default BookPage;
