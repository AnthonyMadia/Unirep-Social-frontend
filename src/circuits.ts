import * as fs from 'fs'
import assert from 'assert'
import lineByLine from 'n-readlines'
import * as path from 'path'
import { SnarkProof, SnarkPublicSignals } from 'libsemaphore'

const snarkjs = require("snarkjs")
const buildPath = "./build"

/*
 * @param circuitPath The subpath to the circuit file (e.g.
 *     test/userStateTransition_test.circom)
 */
// const compileAndLoadCircuit = async (
//     circuitPath: string
// ) => {
//     const circuit = await circom.tester(path.join(
//         __dirname,
//         `../../circuits/${circuitPath}`,
//     ))

//     await circuit.loadSymbols()

//     return circuit
// }

const executeCircuit = async (
    circuit: any,
    inputs: any,
) => {

    const witness = await circuit.calculateWitness(inputs, true)
    await circuit.checkConstraints(witness)
    await circuit.loadSymbols()

    return witness
}

const getSignalByName = (
    circuit: any,
    witness: any,
    signal: string,
) => {

    return witness[circuit.symbols[signal].varIdx]
}

const getSignalByNameViaSym = (
    circuitName: any,
    witness: any,
    signal: string,
) => {
    const symPath = path.join(__dirname, buildPath, `${circuitName}.sym`)
    const liner = new lineByLine(symPath)
    let line
    let index
    let found = false

    while (true) {
        line = liner.next()
        debugger
        if (!line) { break }
        const s = line.toString().split(',')
        if (signal === s[3]) {
            index = s[1]
            found = true
            break
        }
    }

    assert(found)

    if (index !== undefined) {
        return witness[index]
    }
}

const genVerifyEpochKeyProofAndPublicSignals = (
    inputs: any,
) => {
    return genProofAndPublicSignals(
        inputs,
        'verifyEpochKey'
    )
}

const genVerifyUserStateTransitionProofAndPublicSignals = (
    inputs: any,
) => {
    return genProofAndPublicSignals(
        inputs,
        'userStateTransition'
    )
}

const genVerifyReputationProofAndPublicSignals = (
    inputs: any,
) => {
    return genProofAndPublicSignals(
        inputs,
        'proveReputation'
    )
}

const genVerifyReputationFromAttesterProofAndPublicSignals = (
    inputs: any,
) => {
    return genProofAndPublicSignals(
        inputs,
        'proveReputationFromAttester'
    )
}

/// needs to re-write, no shelljs and file allowed, just store in memory ///
const genProofAndPublicSignals = async (
    inputs: any,
    circuitName: string,
) => {
    const circuitWasmPath = path.join(__dirname, buildPath, circuitName + '.wasm')
    const zkeyPath = path.join(__dirname, buildPath, circuitName + '.zkey')

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, circuitWasmPath, zkeyPath);
    // console.log("Proof: ");
    // console.log(JSON.stringify(proof, null, 1));

    return { proof, publicSignals } // proof, publicsignals should be on chain
}

const verifyProof = async (
    circuitName: string,
    proof: any,
    publicSignals: any,
): Promise<boolean> => {

    const zkeyJsonPath = path.join(__dirname, buildPath ,`${circuitName}.zkey.json`)
    console.log('zkey json path: ' + zkeyJsonPath)

    const zKey = await fetch(zkeyJsonPath, {
        'headers': {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }).then(function(response){
        return response.json()
    })
    // console.log('zkey: ' + JSON.stringify(zKey, null, 1))
    const res = await snarkjs.groth16.verify(zKey, publicSignals, proof)
    
    return res
}

const verifyEPKProof = (
    proof: any,
    publicSignals: any,
) => {
    return verifyProof('verifyEpochKey', proof, publicSignals)
}

const verifyUserStateTransitionProof = (
    proof: any,
    publicSignals: any,
) => {
    return verifyProof('userStateTransition', proof, publicSignals)
}

const verifyProveReputationProof = (
    proof: any,
    publicSignals: any,
) => {
    return verifyProof('proveReputation', proof, publicSignals)
}

const verifyProveReputationFromAttesterProof = (
    proof: any,
    publicSignals: any,
) => {
    return verifyProof('proveReputationFromAttester', proof, publicSignals)
}

const formatProofForVerifierContract = (
    _proof: SnarkProof,
) => {

    return ([
        _proof.pi_a[0],
        _proof.pi_a[1],
        _proof.pi_b[0][1],
        _proof.pi_b[0][0],
        _proof.pi_b[1][1],
        _proof.pi_b[1][0],
        _proof.pi_c[0],
        _proof.pi_c[1],
    ]).map((x) => x.toString())
}

export {
    executeCircuit,
    formatProofForVerifierContract,
    getSignalByName,
    getSignalByNameViaSym,
    genVerifyEpochKeyProofAndPublicSignals,
    genVerifyReputationProofAndPublicSignals,
    genVerifyReputationFromAttesterProofAndPublicSignals,
    genVerifyUserStateTransitionProofAndPublicSignals,
    verifyEPKProof,
    verifyProveReputationProof,
    verifyProveReputationFromAttesterProof,
    verifyUserStateTransitionProof,
    genProofAndPublicSignals,
    verifyProof,
}