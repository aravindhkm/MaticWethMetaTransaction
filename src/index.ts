
import web3 from "web3";
import { Interface } from '@ethersproject/abi';
import {MaticWeth} from '../src/Abi/Abi';
import {signTypedData_v4} from 'eth-sig-util';
import dotenv from 'dotenv';
import {ethers} from 'ethers';

dotenv.config(); 

const token_itf = new Interface(MaticWeth);
const currentWeb3 = new web3(new web3.providers.HttpProvider(process.env.TESTNET as string));

const approveBytes = async(spender: any,amount:any) => {
    return token_itf.encodeFunctionData("approve",[spender,amount]) 
}

(async function() {
    const weth = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
    const wethInstance = new currentWeb3.eth.Contract(MaticWeth as any,weth);

    const owner_privatekey: string = process.env.OWNER_PRIVATEKEY as string;
    const spender_privatekey: string = process.env.SPENDER_PRIVATEKEY as string;
    const owner = currentWeb3.eth.accounts.privateKeyToAccount(owner_privatekey).address; 
    const spender = currentWeb3.eth.accounts.privateKeyToAccount(spender_privatekey).address; 
    const amount = BigInt(2 ** 256) - BigInt(1);    

    const chainId = await currentWeb3.eth.getChainId(); 
    const msgData = await approveBytes(spender,amount.toString());
    const nonce = await wethInstance.methods.getNonce(owner).call();
    const chainIdInBytes32 =  currentWeb3.eth.abi.encodeParameter('uint256', chainId);

    const msgParams = {
        types: {
            EIP712Domain:  [
                {name: "name", type: "string"},
                {name: "version", type: "string"},
                {name: "verifyingContract", type: "address"},
                {name: "salt", type: "bytes32"}
            ],
            MetaTransaction: [
                {name: "nonce", type: "uint256"},
                {name: "from", type: "address"},
                {name: "functionSignature", type: "bytes"}
            ]
        },
        domain: {
            name: 'Wrapped Ether',
            version: '1',
            verifyingContract: weth,
            salt: chainIdInBytes32,
        },
        primaryType: "MetaTransaction",
        message: {
          nonce: nonce,
          from: owner,
          functionSignature: msgData
        },
    };  

    const private_key = Buffer.from(owner_privatekey.slice(2), 'hex');
    const data: any = msgParams;
    const signature = signTypedData_v4(private_key, { data });
    const split_vrs = ethers.utils.splitSignature(signature);

    console.log("Args", JSON.stringify({
        "userAddress": owner,
        "functionSignature": msgData,
        "sigR": split_vrs.r,
        "sigS": split_vrs.s,
        "sigV": split_vrs.v,
    },undefined,2));

    await currentWeb3.eth.accounts.wallet.add(spender_privatekey);
    const txGas = await wethInstance.methods.executeMetaTransaction(owner,msgData,split_vrs.r,split_vrs.s,split_vrs.v).estimateGas({from: spender,value: 0});
    const tx = await wethInstance.methods.executeMetaTransaction(owner,msgData,split_vrs.r,split_vrs.s,split_vrs.v).send({from: spender,value: 0,gas: txGas});
    console.log("approve transaction hash", `https://polygonscan.com/tx/${tx.transactionHash}`); 

    console.log("completed");
})();



