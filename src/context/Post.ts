import { createContext } from 'react'
import { makeAutoObservable } from 'mobx'

import { Post, Comment, QueryType } from '../constants'
import { makeURL, convertDataToPost, convertDataToComment } from '../utils'
import UserContext, { User } from './User'
import QueueContext, { Queue } from './Queue'
import UnirepContext, { UnirepConfig } from './Unirep'

const queueContext = (QueueContext as any)._currentValue as Queue
const userContext = (UserContext as any)._currentValue as User
const unirepConfig = (UnirepContext as any)._currentValue as UnirepConfig

export class Data {
    commentsById = {} as { [id: string]: Comment }
    postsById = {} as { [id: string]: Post }
    feedsByQuery = {} as { [query: string]: string[] }
    commentsByPostId = {} as { [postId: string]: string[] }
    commentsByQuery = {} as { [commentId: string]: string[] }

    constructor() {
        makeAutoObservable(this)
    }

    // must be called in browser, not in SSR
    load() {}

    private ingestPosts(_posts: Post | Post[]) {
        const posts = [_posts].flat()
        for (const post of posts) {
            this.postsById[post.id] = post
        }
    }

    private ingestComments(_comments: Comment | Comment[]) {
        const comments = [_comments].flat()
        for (const comment of comments) {
            this.commentsById[comment.id] = comment
        }
    }

    feedKey(query: string, epks = [] as string[]) {
        return epks.length === 0
            ? query
            : `${query}-${epks.sort((a, b) => (a > b ? -1 : 1)).join('_')}`
    }

    async loadPost(id: string) {
        const apiURL = makeURL(`post/${id}`, {})
        const r = await fetch(apiURL)
        const data = await r.json()
        const post = convertDataToPost(data[0])
        this.ingestPosts(post)
    }

    async loadFeed(query: string, lastRead = '0', epks = [] as string[]) {
        const apiURL = makeURL(`post`, {
            query,
            lastRead,
            epks: epks.join('_'),
        })
        const r = await fetch(apiURL)
        const data = await r.json()
        const posts = data.map((p: any) => convertDataToPost(p)) as Post[]
        this.ingestPosts(posts)
        const key = this.feedKey(query, epks)
        if (!this.feedsByQuery[key]) {
            this.feedsByQuery[key] = []
        }
        const ids = {} as { [key: string]: boolean }
        const postIds = posts.map((p) => p.id)
        this.feedsByQuery[key] = [...postIds, ...this.feedsByQuery[key]].filter(
            (id) => {
                if (ids[id]) return false
                ids[id] = true
                return true
            }
        )
    }

    async loadComments(query: string, lastRead = '0', epks = [] as string[]) {
        const apiURL = makeURL(`comment`, {
            query,
            lastRead,
            epks: epks.join('_'),
        })
        const r = await fetch(apiURL)
        const data = await r.json()
        const comments = data.map((p: any) =>
            convertDataToComment(p)
        ) as Comment[]
        const key = this.feedKey(query, epks)
        this.ingestComments(comments)
        if (!this.commentsByQuery[key]) {
            this.commentsByQuery[key] = []
        }
        const ids = {} as { [key: string]: boolean }
        const commentIds = comments.map((c) => c.id)
        this.commentsByQuery[key] = [
            ...commentIds,
            ...this.commentsByQuery[key],
        ].filter((id) => {
            if (ids[id]) return false
            ids[id] = true
            return true
        })
    }

    async loadCommentsByPostId(postId: string) {
        const r = await fetch(makeURL(`post/${postId}/comments`))
        const _comments = await r.json()
        const comments = _comments.map(convertDataToComment) as Comment[]
        this.ingestComments(comments)
        this.commentsByPostId[postId] = comments.map((c) => c.id)
    }

    async loadComment(commentId: string) {
        const r = await fetch(makeURL(`comment/${commentId}`))
        const comment = await r.json()
        if (comment === null) return
        this.ingestComments(convertDataToComment(comment))
    }

    publishPost(
        title: string = '',
        content: string = '',
        epkNonce: number = 0,
        minRep = 0
    ) {
        const user = (UserContext as any)._currentValue

        queueContext.addOp(
            async (updateStatus) => {
                updateStatus({
                    title: 'Creating post',
                    details: 'Generating zk proof...',
                })
                const { proof, publicSignals } = await user.genRepProof(
                    unirepConfig.postReputation,
                    epkNonce,
                    minRep
                )
                updateStatus({
                    title: 'Creating post',
                    details: 'Waiting for TX inclusion...',
                })
                const apiURL = makeURL('post', {})
                const r = await fetch(apiURL, {
                    headers: {
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify({
                        title,
                        content,
                        proof,
                        proveKarma: unirepConfig.postReputation,
                        publicSignals,
                    }),
                    method: 'POST',
                })
                const { transaction, error } = await r.json()
                if (error) throw error
                await queueContext.afterTx(transaction)
                await this.loadFeed(QueryType.New)
            },
            {
                successMessage: 'Post is finalized',
            }
        )
    }

    vote(
        postId: string = '',
        commentId: string = '',
        receiver: string,
        epkNonce: number = 0,
        upvote: number = 0,
        downvote: number = 0,
        minRep = 0
    ) {
        queueContext.addOp(async (updateStatus) => {
            updateStatus({
                title: 'Creating Vote',
                details: 'Generating ZK proof...',
            })
            const { proof, publicSignals } = await userContext.genRepProof(
                upvote + downvote,
                epkNonce,
                Math.max(upvote + downvote, minRep)
            )
            updateStatus({
                title: 'Creating Vote',
                details: 'Broadcasting vote...',
            })
            const r = await fetch(makeURL('vote'), {
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    upvote,
                    downvote,
                    proof,
                    minRep: Math.max(upvote + downvote, minRep),
                    publicSignals,
                    receiver,
                    dataId: postId.length > 0 ? postId : commentId,
                    isPost: !!postId,
                }),
                method: 'POST',
            })
            const { error, transaction } = await r.json()
            if (error) throw error
            updateStatus({
                title: 'Creating Vote',
                details: 'Waiting for transaction...',
            })
            await queueContext.afterTx(transaction)
            if (postId) {
                await this.loadPost(postId)
            }
            if (commentId) {
                await this.loadComment(commentId)
            }
        })
    }

    leaveComment(
        content: string,
        postId: string,
        epkNonce: number = 0,
        minRep = 0
    ) {
        queueContext.addOp(
            async (updateStatus) => {
                updateStatus({
                    title: 'Creating comment',
                    details: 'Generating ZK proof...',
                })
                const { proof, publicSignals } = await userContext.genRepProof(
                    unirepConfig.commentReputation,
                    epkNonce,
                    minRep
                )
                updateStatus({
                    title: 'Creating comment',
                    details: 'Waiting for transaction...',
                })
                const r = await fetch(makeURL('comment'), {
                    headers: {
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify({
                        content,
                        proof,
                        minRep,
                        postId,
                        publicSignals,
                    }),
                    method: 'POST',
                })
                const { transaction, error } = await r.json()
                if (error) throw error
                await queueContext.afterTx(transaction)
                await Promise.all([
                    this.loadCommentsByPostId(postId),
                    this.loadPost(postId),
                ])
            },
            {
                successMessage: 'Comment is finalized!',
            }
        )
    }
}

export default createContext(new Data())
