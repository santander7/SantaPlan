namespace BackendApi.Controllers;

using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class QuotationController : ControllerBase
{
    private const decimal COST_PER_SQUARE_METER = 850.0m;

    public QuotationController()
    {
    }

    [HttpPost("calculate")]
    public ActionResult<QuotationResponse> CalculateCost([FromBody] QuotationRequest request)
    {
        if (request == null || request.SquareMeters <= 0)
        {
            return BadRequest("Los metros cuadrados deben ser mayores a 0.");
        }

        decimal estimatedCost = (decimal)request.SquareMeters * COST_PER_SQUARE_METER;

        var response = new QuotationResponse
        {
            SquareMeters = request.SquareMeters,
            EstimatedCostUSD = estimatedCost,
            CostPerSquareMeter = COST_PER_SQUARE_METER
        };

        return Ok(response);
    }
}

public class QuotationRequest
{
    public double SquareMeters { get; set; }
}

public class QuotationResponse
{
    public double SquareMeters { get; set; }
    public decimal EstimatedCostUSD { get; set; }
    public decimal CostPerSquareMeter { get; set; }
}
