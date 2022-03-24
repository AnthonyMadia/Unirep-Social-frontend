import { ethers } from 'ethers'
import { getUnirepContract } from '@unirep/contracts'
import {
    genIdentity,
    genIdentityCommitment,
    serialiseIdentity,
    unSerialiseIdentity,
} from '@unirep/crypto'
import {
    genUserStateFromContract,
    genEpochKey,
    genUserStateFromParams,
} from '@unirep/unirep'
import { formatProofForVerifierContract } from '@unirep/circuits'
import { UnirepSocialContract } from '@unirep/unirep-social'
import * as config from './config'
import {
    Record,
    Post,
    DataType,
    Vote,
    Comment,
    ActionType,
    QueryType,
} from './constants'
import UnirepContext from './context/Unirep'
import { useContext } from 'react'

const snarkjs = require('snarkjs')

const add0x = (str: string): string => {
    return str.startsWith('0x') ? str : '0x' + str
}

const verifyProof = async (
    circuitName: string,
    proof: any,
    publicSignals: any
) => {
    const vkeyJsonPath = `/build/${circuitName}.vkey.json`
    const vKey = await fetch(vkeyJsonPath).then((res) => res.json())
    const res = await snarkjs.groth16.verify(vKey, publicSignals, proof)
    return res
}
/* circuit functions */

const decodeIdentity = (identity: string) => {
    try {
        const id = unSerialiseIdentity(identity)
        const commitment = genIdentityCommitment(id)
        return { id, commitment, identityNullifier: id.identityNullifier }
    } catch (e) {
        console.log('Incorrect Identity format\n', e)
        return {
            id: BigInt(0),
            commitment: BigInt(0),
            identityNullifier: BigInt(0),
        }
    }
}

export const hasSignedUp = async (identity: string) => {
    const unirepConfig = (UnirepContext as any)._currentValue
    await unirepConfig.loadingPromise

    const { commitment } = decodeIdentity(identity)

    // If user has signed up in Unirep
    const hasUserSignUp = await unirepConfig.unirep.hasUserSignedUp(commitment)
    return {
        hasSignedUp: hasUserSignUp,
    }
}

export const getUserState = async (
    identity: string,
    us?: any,
    update?: boolean
) => {
    const unirepConfig = (UnirepContext as any)._currentValue
    await unirepConfig.loadingPromise
    const { id } = decodeIdentity(identity)
    let userState
    const startTime = new Date().getTime()
    if ((us === undefined || us === null) && update === false) {
        console.log('gen user state from stored us')
        userState = genUserStateFromParams(id, JSON.parse(us))
        const endTime = new Date().getTime()
        console.log(
            `Gen us time: ${endTime - startTime} ms (${Math.floor(
                (endTime - startTime) / 1000
            )} s)`
        )
    } else {
        const parsedUserState = us !== undefined ? JSON.parse(us) : us
        console.log('update user state from stored us')
        userState = await genUserStateFromContract(
            config.DEFAULT_ETH_PROVIDER,
            unirepConfig.unirepAddress,
            id,
            parsedUserState
        )
        const endTime = new Date().getTime()
        console.log(
            `Gen us time: ${endTime - startTime} ms (${Math.floor(
                (endTime - startTime) / 1000
            )} s)`
        )
    }

    const numEpochKeyNoncePerEpoch = unirepConfig.numEpochKeyNoncePerEpoch
    const attesterId = unirepConfig.attesterId
    const jsonedUserState = JSON.parse(userState.toJSON())
    const currentEpoch = userState.getUnirepStateCurrentEpoch()

    return {
        id,
        userState: userState,
        numEpochKeyNoncePerEpoch,
        currentEpoch: Number(currentEpoch),
        attesterId,
        hasSignedUp: jsonedUserState.hasSignedUp,
    }
}

const getEpochKey = (
    epkNonce: number,
    identityNullifier: any,
    epoch: number
) => {
    const unirepConfig = (UnirepContext as any)._currentValue
    if (!unirepConfig.loaded) throw new Error('Unirep config not loaded')
    const epochKey = genEpochKey(
        identityNullifier,
        epoch,
        epkNonce,
        unirepConfig.epochTreeDepth
    )

    return epochKey.toString(16)
}

export const getEpochKeys = (identity: string, epoch: number) => {
    const unirepConfig = (UnirepContext as any)._currentValue
    if (!unirepConfig.loaded) throw new Error('Unirep config not loaded')
    const { identityNullifier } = decodeIdentity(identity)
    const epks: string[] = []
    for (let i = 0; i < unirepConfig.numEpochKeyNoncePerEpoch; i++) {
        const tmp = getEpochKey(i, identityNullifier, epoch)
        epks.push(tmp)
    }
    return epks
}

const genAirdropProof = async (identity: string, us: any) => {
    const unirepConfig = (UnirepContext as any)._currentValue
    await unirepConfig.loadingPromise
    let userState: any = us
    if (userState === null || userState === undefined) {
        const ret = await getUserState(identity, us, false)
        userState = ret.userState
    }
    const attesterId = unirepConfig.attesterId
    let results: any
    try {
        results = await userState.genUserSignUpProof(BigInt(attesterId))
        console.log(results)
        console.log('---userState---')
        console.log(userState.toJSON())
    } catch (e) {
        const ret = await getUserState(identity, us, true)
        userState = ret.userState
        results = await userState.genUserSignUpProof(BigInt(attesterId))
        console.log(results)
    }

    return {
        proof: formatProofForVerifierContract(results.proof),
        publicSignals: results.publicSignals,
        userState: userState,
    }
}

// export const signUpUnirepUser = async (identity: string, us: any) => {
//     const { proof, publicSignals, userState } = await genAirdropProof(identity, us);

//     const apiURL = makeURL('signup', {})
//     const data = {
//         proof: proof,
//         publicSignals: publicSignals,
//     }
//     const stringifiedData = JSON.stringify(data)
//     let transaction: string = ''
//     await fetch(apiURL, {
//             headers: header,
//             body: stringifiedData,
//             method: 'POST',
//         }).then(response => response.json())
//         .then(function(data){
//             console.log(JSON.stringify(data))
//             transaction = data.transaction
//         });

//     return { transaction, userState }
// }

export const getAirdrop = async (identity: string, us: any) => {
    const unirepConfig = (UnirepContext as any)._currentValue
    await unirepConfig.loadingPromise
    const { proof, publicSignals, userState } = await genAirdropProof(
        identity,
        us
    )
    const { identityNullifier } = decodeIdentity(identity)
    const epk = genEpochKey(
        identityNullifier,
        userState.getUnirepStateCurrentEpoch(),
        0
    )
    const gotAirdrop = await unirepConfig.unirepSocial.isEpochKeyGotAirdrop(epk)
    if (gotAirdrop) return { error: 'The epoch key has been airdropped.' }

    const apiURL = makeURL('airdrop', {})
    const data = {
        proof: proof,
        publicSignals: publicSignals,
    }
    const stringifiedData = JSON.stringify(data)
    const r = await fetch(apiURL, {
        headers: header,
        body: stringifiedData,
        method: 'POST',
    })
    const { error, transaction } = await r.json()
    return { error, transaction, userState }
}

const genProof = async (
    identity: string,
    epkNonce: number = 0,
    proveKarmaAmount: number,
    minRep: number = 0,
    us: any,
    spent: number = -1
) => {
    const unirepConfig = (UnirepContext as any)._currentValue
    await unirepConfig.loadingPromise
    let userState: any = us
    let currentEpoch: number
    if (userState === null || userState === undefined) {
        const ret = await getUserState(identity, us, true)
        userState = ret.userState
    } else {
        const ret = await getUserState(identity, us, false)
        userState = ret.userState
    }
    const { identityNullifier } = decodeIdentity(identity)

    currentEpoch = Number(await unirepConfig.currentEpoch())
    const epk = getEpochKey(epkNonce, identityNullifier, currentEpoch)

    if (epkNonce >= unirepConfig.numEpochKeyNoncePerEpoch) {
        console.error('no such epknonce available')
    }

    let rep: any
    try {
        rep = userState.getRepByAttester(unirepConfig.attesterId)
    } catch (e) {
        const ret = await getUserState(identity)
        userState = ret.userState
        rep = userState.getRepByAttester(unirepConfig.attesterId)
    }

    console.log(userState.toJSON(4))

    // find valid nonce starter
    const nonceList: BigInt[] = []
    let nonceStarter: number = spent

    if (nonceStarter === -1) {
        console.error('Error: All nullifiers are spent')
    }
    if (
        nonceStarter + proveKarmaAmount >
        Number(rep.posRep) - Number(rep.negRep)
    ) {
        console.error('Error: Not enough reputation to spend')
    }
    for (let i = 0; i < proveKarmaAmount; i++) {
        nonceList.push(BigInt(nonceStarter + i))
    }
    for (let i = proveKarmaAmount; i < unirepConfig.maxReputationBudget; i++) {
        nonceList.push(BigInt(-1))
    }

    // gen proof
    const startTime = new Date().getTime()
    const proveGraffiti = BigInt(0)
    const graffitiPreImage = BigInt(0)
    let results
    try {
        results = await userState.genProveReputationProof(
            BigInt(unirepConfig.attesterId),
            epkNonce,
            BigInt(minRep),
            proveGraffiti,
            graffitiPreImage,
            nonceList
        )
    } catch (e) {
        console.log(e)
        return undefined
    }

    console.log(results)
    const endTime = new Date().getTime()
    console.log(
        `Gen proof time: ${endTime - startTime} ms (${Math.floor(
            (endTime - startTime) / 1000
        )} s)`
    )

    const proof = formatProofForVerifierContract(results.proof)
    const publicSignals = results.publicSignals

    return { epk, proof, publicSignals, currentEpoch, userState }
}

export const makeURL = (action: string, data: any = {}) => {
    const params = new URLSearchParams(data)
    return `${config.SERVER}/api/${action}?${params}`
}

const header = {
    'content-type': 'application/json',
    // 'Access-Control-Allow-Origin': config.SERVER,
    // 'Access-Control-Allow-Credentials': 'true',
}

export const checkInvitationCode = async (invitationCode: string) => {
    const apiURL = makeURL('genInvitationCode/' + invitationCode, {})
    const r = await fetch(apiURL)
    return r.ok
}

export const userSignUp = async () => {
    const unirepConfig = (UnirepContext as any)._currentValue
    await unirepConfig.loadingPromise
    const id = genIdentity()
    const commitment = genIdentityCommitment(id).toString(16).padStart(64, '0')

    const serializedIdentity = serialiseIdentity(id)

    const currentEpoch = Number(await unirepConfig.currentEpoch())
    const epk1 = getEpochKey(0, id.identityNullifier, currentEpoch)

    // call server user sign up
    const apiURL = makeURL('signup', {
        commitment: commitment,
        epk: epk1,
    })
    const r = await fetch(apiURL)
    const { epoch } = await r.json()
    return {
        i: serializedIdentity,
        c: commitment,
        epoch,
    }
}

export const publishPost = async (
    content: string,
    epkNonce: number,
    identity: string,
    minRep?: number,
    spent: number = 0,
    us?: any,
    title: string = ''
) => {
    const unirepConfig = (UnirepContext as any)._currentValue
    await unirepConfig.loadingPromise
    if (typeof minRep === 'undefined') minRep = unirepConfig.postReputation
    const ret = await genProof(
        identity,
        epkNonce,
        unirepConfig.postReputation,
        minRep,
        us,
        spent
    )

    if (ret === undefined) {
        return {
            error: 'genProof error, ret is undefined',
            transaction: undefined,
            currentEpoch: 0,
            epk: '',
            userState: undefined,
        }
    }

    // to backend: proof, publicSignals, content
    const apiURL = makeURL('post', {})
    const r = await fetch(apiURL, {
        headers: header,
        body: JSON.stringify({
            title,
            content,
            proof: ret.proof,
            minRep,
            publicSignals: ret.publicSignals,
        }),
        method: 'POST',
    })
    const { transaction, error } = await r.json()
    return {
        error,
        transaction,
        currentEpoch: ret.currentEpoch,
        epk: ret.epk,
        userState: ret.userState,
    }
}

export const vote = async (
    identity: string,
    upvote: number,
    downvote: number,
    dataId: string,
    receiver: string,
    epkNonce: number = 0,
    minRep: number = 0,
    isPost: boolean = true,
    spent: number = 0,
    us: any
) => {
    // upvote / downvote user
    const voteValue = upvote + downvote
    const ret = await genProof(identity, epkNonce, voteValue, minRep, us, spent)
    if (ret === undefined) {
        return {
            error: 'genProof error, ret is undefined',
            epk: '',
            transaction: undefined,
            userState: undefined,
        }
    }

    // send publicsignals, proof, voted post id, receiver epoch key, graffiti to backend
    const apiURL = makeURL('vote', {})
    const data = {
        upvote,
        downvote,
        proof: ret.proof,
        minRep,
        publicSignals: ret.publicSignals,
        receiver,
        dataId,
        isPost,
    }
    const stringifiedData = JSON.stringify(data)
    console.log('before vote api: ' + stringifiedData)

    const r = await fetch(apiURL, {
        headers: header,
        body: stringifiedData,
        method: 'POST',
    })
    const { error, transaction } = await r.json()
    return { error, epk: ret.epk, transaction, userState: ret.userState }
}

export const leaveComment = async (
    identity: string,
    content: string,
    postId: string,
    epkNonce: number = 0,
    minRep?: number,
    spent: number = 0,
    us?: any
) => {
    const unirepConfig = (UnirepContext as any)._currentValue
    await unirepConfig.loadingPromise
    if (typeof minRep === 'undefined') minRep = unirepConfig.commentReputation
    const ret = await genProof(
        identity,
        epkNonce,
        unirepConfig.commentReputation,
        minRep,
        us,
        spent
    )

    if (ret === undefined) {
        return {
            error: 'genProof error, ret is undefined',
            transaction: '',
            commentId: '',
            currentEpoch: 0,
            epk: '',
            userState: undefined,
        }
    }

    // to backend: proof, publicSignals, content
    const apiURL = makeURL('comment', {})
    const data = {
        content,
        proof: ret.proof,
        minRep,
        postId,
        publicSignals: ret.publicSignals,
    }
    const stringifiedData = JSON.stringify(data)
    console.log('before leave comment api: ' + stringifiedData)

    const r = await fetch(apiURL, {
        headers: header,
        body: stringifiedData,
        method: 'POST',
    })
    const { transaction, commentId, error } = await r.json()
    return {
        error,
        transaction,
        commentId,
        currentEpoch: ret.currentEpoch,
        epk: ret.epk,
        userState: ret.userState,
    }
}

export const updateUserState = async (identity: string, us?: any) => {
    let airdropRet
    const ret = await getUserState(identity, us, true)
    if (ret.currentEpoch !== ret.userState.latestTransitionedEpoch) {
        const transitionRet = await userStateTransition(
            identity,
            ret.userState.toJSON()
        )
        const userStateResult = await getUserState(
            identity,
            transitionRet.userState.toJSON(),
            true
        )
        airdropRet = await getAirdrop(identity, userStateResult.userState)
    }
    const epks = getEpochKeys(identity, ret.currentEpoch)
    const spent = await getEpochSpent(epks)
    return { error: airdropRet?.error, userState: ret.userState, spent: spent }
}

export const userStateTransition = async (identity: string, us: any) => {
    const { userState } = await getUserState(identity)
    const results = await userState.genUserStateTransitionProofs()

    const fromEpoch = userState.latestTransitionedEpoch
    const toEpoch = userState.getUnirepStateCurrentEpoch()

    const apiURL = makeURL('userStateTransition', {})
    const data = {
        results,
        fromEpoch,
    }

    const stringifiedData = JSON.stringify(data)
    console.log('before UST api: ' + stringifiedData)

    const r = await fetch(apiURL, {
        headers: header,
        body: stringifiedData,
        method: 'POST',
    })
    const { transaction, error } = await r.json()

    return { error, transaction, toEpoch, userState }
}

export const getRecords = async (currentEpoch: number, identity: string) => {
    const unirepConfig = (UnirepContext as any)._currentValue
    await unirepConfig.loadingPromise
    const { commitment } = decodeIdentity(identity)
    const epks: string[] = []
    for (let i = 1; i <= currentEpoch; i++) {
        const epksRet = getEpochKeys(identity, i)
        epks.push(...epksRet)
    }

    const commitmentAPIURL = makeURL(`records`, { commitment })
    const paramStr = epks.join('_')
    const apiURL = makeURL(`records/${paramStr}`, {})
    console.log(apiURL)

    const getCommitment = fetch(commitmentAPIURL)
        .then((response) => response.json())
        .then((data) => {
            if (data.length === 0) return
            const signupRecord: Record = {
                action: ActionType.Signup,
                from: 'SignUp Airdrop',
                to: data[0].to,
                upvote: unirepConfig.airdroppedReputation,
                downvote: 0,
                epoch: data[0].epoch,
                time: Date.parse(data[0].created_at),
                data_id: '',
                content: '',
            }
            return signupRecord
        }) as Promise<Record>

    const getGeneralRecords = fetch(apiURL)
        .then((response) => response.json())
        .then((data) => {
            const records: Record[] = []
            for (let i = 0; i < data.length; i++) {
                const record: Record = {
                    action: data[i].action,
                    from: data[i].from,
                    to: data[i].to,
                    upvote: data[i].upvote,
                    downvote: data[i].downvote,
                    epoch: data[i].epoch,
                    time: Date.parse(data[i].created_at),
                    data_id: data[i].data,
                    content: data[i].content,
                }
                records.unshift(record)
            }
            return records
        }) as Promise<Record[]>

    const allRecords = await Promise.all([getCommitment, getGeneralRecords])

    return allRecords.flat()
}

export const getEpochSpent = async (epks: string[]) => {
    const paramStr = epks.join('_')
    const apiURL = makeURL(`records/${paramStr}`, { spentonly: true })
    console.log(apiURL)

    const r = await fetch(apiURL)
    const data = await r.json()
    const totalSpent = data.reduce((acc: number, v: any) => {
        return acc + v.spent
    }, 0)
    return totalSpent
}

const convertDataToVotes = (data: any) => {
    if (data === null || data === undefined)
        return { votes: [], upvote: 0, downvote: 0 }
    const votes: Vote[] = []
    let upvote: number = 0
    let downvote: number = 0
    for (let i = 0; i < data.length; i++) {
        const posRep = Number(data[i].posRep)
        const negRep = Number(data[i].negRep)
        const vote: Vote = {
            upvote: posRep,
            downvote: negRep,
            epoch_key: data[i].voter,
        }
        upvote += posRep
        downvote += negRep
        votes.push(vote)
    }

    return { votes, upvote, downvote }
}

const convertDataToComment = (data: any) => {
    const { votes, upvote, downvote } = convertDataToVotes(data.votes)
    const comment = {
        type: DataType.Comment,
        id: data.transactionHash,
        post_id: data.postId,
        content: data.content,
        votes,
        upvote,
        downvote,
        epoch_key: data.epochKey,
        username: '',
        post_time: Date.parse(data.created_at),
        reputation: data.minRep,
        current_epoch: data.epoch,
        proofIndex: data.proofIndex,
    }

    return comment
}

export const convertDataToPost = (
    data: any,
    commentsOnlyId: boolean = true
) => {
    const { votes, upvote, downvote } = convertDataToVotes(data.votes)

    const comments: Comment[] = []
    if (!commentsOnlyId) {
        for (let i = 0; i < data.comments.length; i++) {
            const comment = convertDataToComment(data.comments[i])
            comments.push(comment)
        }
    }

    const post: Post = {
        type: DataType.Post,
        id: data.transactionHash,
        title: data.title,
        content: data.content,
        votes,
        upvote,
        downvote,
        epoch_key: data.epochKey,
        username: '',
        post_time: Date.parse(data.created_at),
        reputation: data.minRep,
        comments,
        commentsCount: comments.length,
        current_epoch: data.epoch,
        proofIndex: data.proofIndex,
    }

    return post
}

export const listAllPosts = async () => {
    const apiURL = makeURL(`post`, {})

    const r = await fetch(apiURL)
    const data = await r.json()
    return data.map((p: any) => convertDataToPost(p)) as Post[]
}

export const getPostById = async (postid: string) => {
    const apiURL = makeURL(`post/${postid}`, {})
    const r = await fetch(apiURL)
    const data = await r.json()
    return convertDataToPost(data, false)
}

export const getPostsByQuery = async (
    query: QueryType,
    lastRead: string = '0',
    epks: string[] = []
) => {
    const apiURL = makeURL(`post`, { query, lastRead, epks: epks.join('_') })
    console.log(apiURL)

    const r = await fetch(apiURL)
    const data = await r.json()
    return data.map((p: any) => convertDataToPost(p)) as Post[]
}

export const getCommentsByQuery = async (
    query: QueryType,
    lastRead: string = '0',
    epks: string[] = []
) => {
    const apiURL = makeURL(`comment`, { query, lastRead, epks: epks.join('_') })
    console.log(apiURL)
    const r = await fetch(apiURL)
    const data = await r.json()
    return data.map((c: any) => convertDataToComment(c)) as Comment[]
}

export const sentReport = async (issue: string, email: string) => {
    const apiURL = makeURL(`report`, { issue, email })
    const r = await fetch(apiURL)
    return r.ok
}

//////////////////////////////// Admin related //////////////////////////////////
export const checkIsAdminCodeValid = async (code: string) => {
    const apiURL = makeURL('admin', { code })
    const r = await fetch(apiURL)
    return r.ok
}

export const adminLogin = async (id: string, password: string) => {
    const apiURL = makeURL('admin', { id, password })
    const r = await fetch(apiURL)
    if (!r.ok) return ''
    return r.json()
}

export const genInvitationCode = async (code: string) => {
    const apiURL = makeURL('genInvitationCode', { code })
    const r = await fetch(apiURL)
    if (!r.ok) return ''
    return r.json()
}
