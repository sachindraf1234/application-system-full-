==============================================================================
e-Visa Romania Playwright & OpenCV Automation Package
Applicant File: E25110721257414
==============================================================================

INSTRUCTIONS TO RUN ON YOUR LOCAL WINDOWS PC:

1. Extract this entire ZIP folder to your preferred folder (e.g. C:\VisaDocs\ or Desktop).
2. Supporting Documents & Photo Location:
   - Ensure your supporting document files are in: C:\Users\R E V O\Downloads\MALEESHA SANKALPA\VISA SUBMISSION
   - Required filenames:
     * photo.jpg               (Applicant photo - OpenCV automatically recognizes face, resizes, and calibrates green frame coordinates)
     * work_permit.pdf         (Romanian IGI Work Permit)
     * AGREEMENT.pdf           (Means of Support / Accommodation Agreement)
     * police_clearance.pdf    (Criminal Record Clearance)
     * medical_insurance.pdf   (Travel Medical Insurance)
     * passport.pdf            (Valid Travel Document / Passport Copy)

3. OpenCV Photo Calibration & Travel Document Page:
   - The script uses OpenCV (cv2) Haar Cascades to automatically detect the applicant's face.
   - Calculates the exact 3:4 passport aspect ratio bounding box with Romanian visa head-clearance.
   - Snaps the portal's green frame (#guideline) to the face and triggers the crop action smoothly.

4. Launch Automation:
   - Double-click "run_evisa_automation_E25110721257414.bat".
   - The launcher will automatically verify Python, install Playwright, OpenCV, and Chromium,
     launch the browser in headful mode, and execute the automated data filling,
     photo recognition/cropping, and document uploading steps.

5. Manual Inspection & Final Submission:
   - The browser will navigate through all pages automatically.
   - At the Summary page, review the filled fields before clicking Final Submit.
