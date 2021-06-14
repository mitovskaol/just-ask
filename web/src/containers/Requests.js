import axios from "../axios";
import { useContext, useState } from "react";
import { Box, Button, Text } from "rebass";
import { WidthControlledContainer } from "../components/Containers";
import RequestForm from "../components/RequestForm";
import { ROLES } from "../constants";
import { AuthContext } from "../providers/AuthContext";
import { useAuth, useGetOrganizations } from "../utils/hooks"
import { Notice } from "../components/Notice";
import { ConfigContext } from "../providers/ConfigProvider";


const Requests = () => {
  const { state } = useContext(AuthContext)
  const { noIndividualOrgRequests } = useContext(ConfigContext);
  const {auth: role, fetching: authFetching} = useAuth();
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const {orgs, fetching} =  useGetOrganizations();
  const orgsFound = !fetching && orgs && orgs.length;

  return (
    <WidthControlledContainer>
      <Box py={6} maxWidth={[800, 400, 600]} >
        {!orgsFound && !loading && !fetching && <Text fontSize={4}>Just.Ask has been misconfigured. Double check if the github app has been installed on at least one organization</Text>}
        <Text as="h2">Invitations</Text>
      </Box>
      
      <Box fontSize={5}>
        {(loading || fetching) && <Text> Loading...</Text>}
        {orgsFound && !formSubmitted && !authFetching && role && <RequestForm autoSelectCheckboxes={noIndividualOrgRequests} username={state.isLoggedIn && state.user.login} organizations={orgs} isRequester={!authFetching && role === ROLES.REQUESTER} onSubmit={data => {
          setLoading(true);
          setError(null);
          axios.post('/requests',  
            data
          , {
            headers: {
              authorization: `Bearer ${state.token.access_token}`,
              accept: 'application/json'
            }
          })
          .catch((e) => {
            if(e.response) {
              setError(e.response.data.message);
            } else {
              setError(e.message)
            }
          })
          .finally(() => {
            setFormSubmitted(true);
            setLoading(false);
          })
        }}/>}
      </Box>
      {orgsFound && formSubmitted && !error && <Box>
        <Notice type="info" mb={4}>You request for the org membership has been submitted successfully. An email with the org invites will be sent to the email associated with the provided GitHub account. Once both invites are accepted, the GitHub ID will be added to the orgs.</Notice>
        <Button bg="secondary" color="primary" sx={{cursor: 'pointer'}} onClick={() => setFormSubmitted(false)}>Request another invite</Button>
      </Box>}
      {error && <Box>
        <Notice type="error" mb={4}>{error}</Notice>
        <Button bg="secondary" color="primary" sx={{cursor: 'pointer'}} onClick={() => {
          setFormSubmitted(false);
          setError(null);
        }}>Okay</Button>
      </Box> }
    </WidthControlledContainer>)
}

export default Requests;
