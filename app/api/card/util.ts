// Read merchant settings file
import path from "path";
import {readFile} from "fs/promises";
import {MerchantSettings} from "@/app/api/types/types";


export const findMerchant = async (business_id: string): Promise<MerchantSettings | undefined> => {
    const filePath = path.join(process.cwd(), 'app/api/data/merchant_settings.json');
    const fileContent = await readFile(filePath, 'utf-8');
    const merchants: MerchantSettings[] = JSON.parse(fileContent);

    // Find merchant by business_id
    return merchants.find(m => m.business_id === business_id);
}