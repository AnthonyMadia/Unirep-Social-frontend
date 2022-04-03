import { createContext } from 'react'
import { Post, User, Page, Draft } from '../constants'

type GlobalContent = {
    shownPosts: Post[]
    setShownPosts: (posts: Post[]) => void
    isMenuOpen: boolean
    setIsMenuOpen: (value: boolean) => void
    page: Page
    setPage: (value: Page) => void
    adminCode: string
    setAdminCode: (value: string) => void
    draft: null | Draft
    setDraft: (value: any) => void
}

export const WebContext = createContext<GlobalContent>({
    shownPosts: [],
    setShownPosts: () => {},
    isMenuOpen: false,
    setIsMenuOpen: () => {},
    page: Page.Home,
    setPage: () => {},
    adminCode: '',
    setAdminCode: () => {},
    draft: null,
    setDraft: () => {},
})
