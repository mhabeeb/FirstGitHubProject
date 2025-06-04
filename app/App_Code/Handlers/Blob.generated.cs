namespace MyCompany.Handlers
{


    public partial class BlobFactoryConfig : BlobFactory
    {

        public static void Initialize()
        {
            // register blob handlers
            RegisterHandler("site_contentdata", "\"public\".\"site_content\"", "\"data\"", new string[] {
                        "\"site_content_id\""}, "Public Site Content Data", "public_site_content", "data");
        }
    }
}
