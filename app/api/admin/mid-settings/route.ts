import {NextRequest, NextResponse} from 'next/server';
import {readFile, writeFile} from 'fs/promises';
import path from 'path';
import {MidSettings} from "@/app/api/types/types";

export async function PATCH(request: NextRequest) {
    try {

        // TODO: with auth should be only accessible by admin
        const body = await request.json();
        const {mid_id, status} = body;

        // Validate required fields
        if (!mid_id || !status) {
            return NextResponse.json(
                {success: false, error: 'Missing required fields: mid_id, status'},
                {status: 400}
            );
        }

        // Validate status value - must be exactly "ACTIVE" or "INACTIVE"
        if (status !== 'ACTIVE' && status !== 'INACTIVE') {
            return NextResponse.json(
                {success: false, error: 'Invalid status. Must be exactly "ACTIVE" or "INACTIVE"'},
                {status: 400}
            );
        }

        // Read mid_settings.json
        const midFilePath = path.join(process.cwd(), 'app/api/data/mid_settings.json');
        const midFileContent = await readFile(midFilePath, 'utf-8');
        const midSettings: MidSettings[] = JSON.parse(midFileContent);

        // Find MID by id
        const midIndex = midSettings.findIndex(mid => mid.id === mid_id);

        if (midIndex === -1) {
            return NextResponse.json(
                {success: false, error: `MID not found with id: ${mid_id}`},
                {status: 404}
            );
        }

        // Update status
        const previousStatus = midSettings[midIndex].status;
        midSettings[midIndex].status = status;

        // Write back to file
        await writeFile(midFilePath, JSON.stringify(midSettings, null, 2), 'utf-8');

        console.log(`Updated MID ${mid_id}: ${previousStatus} → ${status}`);

        return NextResponse.json(
            midSettings[midIndex]
        );

    } catch (error) {
        console.error('Error updating MID status:', error);
        return NextResponse.json(
            {success: false, error: 'Invalid request or server error'},
            {status: 400}
        );
    }
}
