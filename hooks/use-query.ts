'use client'

import { useEffect, useState } from 'react'

interface UseQueryState<T> {
  data: T | null
  error: Error | null
  loading: boolean
}

export function useQuery<T>(url: string): UseQueryState<T> {
  const [state, setState] = useState<UseQueryState<T>>({
    data: null,
    error: null,
    loading: true,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true }))
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setState({ data, error: null, loading: false })
      } catch (error) {
        setState({
          data: null,
          error: error instanceof Error ? error : new Error('Unknown error'),
          loading: false,
        })
      }
    }
    fetchData()
  }, [url])

  return state
}
