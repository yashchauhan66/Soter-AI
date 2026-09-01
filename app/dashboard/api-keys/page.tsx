import dynamicImport from "next/dynamic";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/PageHeader";
export const dynamic="force-dynamic";
const ApiKeyManager=dynamicImport(()=>import("@/components/dashboard/ApiKeyManager").then((mod)=>mod.ApiKeyManager));
export default async function ApiKeysPage(){const user=await getCurrentUser();const [projects,keys]=await Promise.all([db.project.findMany({where:{userId:user.id},select:{id:true,name:true},take:50}),db.apiKey.findMany({where:{project:{userId:user.id}},select:{id:true,name:true,prefix:true,projectId:true,isActive:true,lastUsedAt:true,createdAt:true,project:{select:{name:true}}},orderBy:{createdAt:"desc"},take:100})]);return <div><PageHeader
        eyebrow="Credentials"
        title="API keys"
        description="Keys are project scoped. Only their hashes are stored."
      /><ApiKeyManager projects={projects} keys={keys}/></div>}
