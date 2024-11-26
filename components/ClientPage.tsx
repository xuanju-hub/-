'use client'

import dynamic from 'next/dynamic'

const ImageTranslationApp = dynamic(() => import('./ImageTranslationApp'), {
  ssr: false
})

export default function ClientPage() {
  return <ImageTranslationApp />
} 